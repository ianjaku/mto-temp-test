/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Either, Maybe } from "@binders/client/lib/monad";
import {
    ImageFormat,
    Visual,
    VisualFormat,
    VisualIdentifier,
    visualFormatTypeToString
} from  "../../api/model";
import { LocalFileCopy, MediaStorageOverHTTP, StorageURL } from "../contract";
import AzureClient from "./AzureClient";
import { Config } from "@binders/client/lib/config/config";
import { IBLOBImageStorageConfig } from "./contract";
import { IExpressResponseOptions } from "@binders/binders-service-common/lib/storage/object_storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { VisualFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";


export function buildBLOBConfig(config: Config, rootKey: string): Either<Error, IBLOBImageStorageConfig> {
    const packedConfig = {
        accessKey: config.getString(`${rootKey}.accessKey`),
        account: config.getString(`${rootKey}.account`),
        container: config.getString(`${rootKey}.container`)
    };
    return Maybe.unpack(packedConfig);
}

export default class AzureBlobStorage extends MediaStorageOverHTTP {
    private azureClient: AzureClient;
    private account: string;
    private container: string;
    private accessKey: string;

    constructor(logger: Logger, config: IBLOBImageStorageConfig) {
        super(logger);
        this.account = config.account;
        this.container = config.container;
        this.accessKey = config.accessKey;
        this.createClient(logger);
    }

    getFontLocation(name, weight, style): string {
        return `${name}/${weight}/${style}.woff`;
    }

    getStorageLocation(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): string {
        if (!binderId) {
            throw new Error("Could not get storage location, binderId unknown");
        }
        return "/" + MediaStorageOverHTTP.getVisualKey(binderId, visualId, formatType);
    }

    async getLocalCopy(visual: Visual, formatType: VisualFormatType, _extension?: string): Promise<LocalFileCopy> {
        const { binderId, id: visualId } = visual;
        const location = this.getStorageLocation(binderId, visualId, formatType);
        return this.azureClient.getLocalCopy(this.container, location);
    }

    async getStoragePath(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<string> {
        const scheme = await this.getStorageScheme(binderId, visualId, formatType);
        return scheme + this.account + "/" +
            this.container + this.getStorageLocation(binderId, visualId, formatType);
    }

    async getStorageURL(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<StorageURL> {
        const url = await this.getStoragePath(binderId, visualId, formatType);
        return new StorageURL(url);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getStorageScheme(binderId: string, visualId: VisualIdentifier, formatType: VisualFormatType): Promise<string> {
        return AzureBlobStorage.getScheme();
    }

    static getScheme(): string {
        return "azure://";
    }

    private createClient(logger: Logger) {
        this.azureClient = new AzureClient(logger, this.account, this.accessKey);
    }

    sendFontFileWithExpress(name, weight, style, response) {
        const blob = name + "/" + weight + "/" + style + ".woff";
        return this.azureClient.streamBlobToExpress(this.container, blob, response);
    }

    sendFontFaceFileWithExpress(name, response) {
        const blob = name + "/" + name + ".css";
        return this.azureClient.streamBlobToExpress(this.container, blob, response);
    }

    private extractBlobPathFromVisual(visual: Visual, formatType: VisualFormatType): string {
        const formatSuffix = visualFormatTypeToString(formatType);
        const findFormat: (format: VisualFormat) => boolean = (f: VisualFormat) => {
            return f.storageLocation.endsWith(formatSuffix);
        }
        const format: VisualFormat = (visual.formats as ImageFormat[]).find(findFormat);
        const scheme = AzureBlobStorage.getScheme();
        const pat = `${scheme}${this.account}/${this.container}`;
        if (format) {
            return format.storageLocation.replace(new RegExp(pat, "g"), "");
        }
        if (formatType !== 0) {
            return this.extractBlobPathFromVisual(visual, 0);
        }
        throw new Error("No original format available?");
    }

    async sendFileWithExpress(
        visual: Visual,
        formatType: VisualFormatType,
        options: IExpressResponseOptions,
        response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next
    ): Promise<void> {
        const blob = this.extractBlobPathFromVisual(visual, formatType);
        await this.azureClient.streamBlobToExpress(this.container, blob, response, options);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async uploadFontFile(localFile, name, weight, style) {
        const blob = this.getFontLocation(name, weight, style);
        const createOptions = { contentType: "font/woff" };
        await this.azureClient.createBlobFromLocalFile(this.container, blob, localFile, createOptions);
    }

    async uploadFontFaceFile(localFile: string, blob: string) {
        const createOptions = { contentType: "text/css" };
        await this.azureClient.createBlobFromLocalFile(this.container, blob, localFile, createOptions);
    }

    protected async uploadFile(localFile, binderId, visualId, formatType, mime): Promise<void> {
        const blob = this.getStorageLocation(binderId, visualId, formatType);
        const createOptions = { contentType: mime };
        await this.azureClient.createBlobFromLocalFile(this.container, blob, localFile, createOptions);
    }

    static containerMatches(url: string, storage: AzureBlobStorage): boolean {
        const prefix = AzureBlobStorage.getScheme() +
            storage.account + "/" +
            storage.container + "/";
        return url.startsWith(prefix);
    }
}