import {
    BlobServiceClient,
    ContainerSASPermissions,
    StorageSharedKeyCredential,
    newPipeline
} from "@azure/storage-blob";
import { add, sub } from "date-fns";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ContainerSASTokenCache } from "./ContainerSASTokenCache";
import { Video } from "../../api/model";
import { VideoFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";


const builders: Record<string, AzureURLBuilder> = {};

function getBuilder(config: BindersConfig, key: string, cdn?: string) {
    const builderKey = `${key}-${cdn || ""}`;
    if (!builders[builderKey]) {
        builders[builderKey] = AzureURLBuilder.fromConfig(config, key, cdn);
    }
    return builders[builderKey];
}

export async function buildOriginalVideoAzureURL(
    video: Video,
    config: BindersConfig,
): Promise<string> {
    const format = video.formats.find(f => f.format === VideoFormatType.ORIGINAL);
    if (!format?.container) {
        throw new Error(`No container found in ORIGINAL format of video ${video.id.value()}`);
    }
    return buildVideoAzureURL(config, format.container, "ORIGINAL", false);
}

export async function buildVideoAzureURL(
    config: BindersConfig,
    containerName: string,
    blobName: string,
    cdnnify = true,
): Promise<string> {
    if (containerName.startsWith("vid-")) {
        const builder = getBuilder(config, "azure.blobs.videos-v2");
        return builder.buildVideoUrl(containerName, blobName);
    }
    const cdnEndpointKey = cdnnify ? "azure.videosCdnEndpoint" : undefined;
    const builder = getBuilder(config, "azure.blobs.videos", cdnEndpointKey);
    return builder.buildVideoUrl(containerName, blobName);
}

export function buildImageAzureURL(config: BindersConfig, binderId: string, visualId: string, formatName: string, cdnnify = true): Promise<string> {
    const cdnEndpointKey = cdnnify ? "azure.visualsCdnEndpoint" : undefined;
    const configKey = "azure.blobs.images";
    const builder = getBuilder(config, configKey, cdnEndpointKey);
    return builder.buildImageUrl(binderId, visualId, formatName);
}

const CDN_TOKEN_TTL_IN_MINUTES = 60 * 24; // Make CDN link tokens expire after 24 hours
const SAS_TOKEN_CACHE_TTL = 30 * 60 * 1000; // Cache SAS tokens for 30 minutes

class AzureURLBuilder {

    private tokenCache: ContainerSASTokenCache;

    constructor(
        private account: string,
        private accessKey: string,
        private container: string,
        private host?: string
    ) {
        this.tokenCache = new ContainerSASTokenCache();
    }

    static fromConfig(config: BindersConfig, accountConfigKey: string, cdnConfigKey?: string): AzureURLBuilder {
        const maybeConfig = config.getObject(accountConfigKey);
        if (maybeConfig.isNothing()) {
            throw new Error(`Missing account config values for ${accountConfigKey}`);
        }
        const cndEndpoint = cdnConfigKey && config.getString(cdnConfigKey).getOrElse(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const azureConfig = maybeConfig.get() as any;
        return new AzureURLBuilder(
            azureConfig.account,
            azureConfig.accessKey,
            azureConfig.container,
            cndEndpoint
        );
    }

    private getStorageAccountHost() {
        return this.host || `${this.account}.blob.core.windows.net`;
    }

    private getContainerClient(containerName: string) {
        const sharedKeyCredential = new StorageSharedKeyCredential(this.account, this.accessKey);
        const pipeline = newPipeline(
            sharedKeyCredential,
            {
                retryOptions: { maxTries: 10 }
            },
        );
        const host = this.getStorageAccountHost();
        const blobServiceClient = new BlobServiceClient(
            `https://${host}`,
            pipeline
        )
        return blobServiceClient.getContainerClient(containerName);
    }

    private getSasOptions() {
        const now = new Date();
        const startsOn = sub(now, { hours: 1 });
        const expiresOn = add(now, { minutes: CDN_TOKEN_TTL_IN_MINUTES });
        return {
            permissions: ContainerSASPermissions.parse("r"),
            expiresOn,
            startsOn
        };
    }

    private async getSasUrl(containerName: string, blobName: string): Promise<string> {
        let token = this.tokenCache.getToken(containerName);
        if (!token) {
            const containerClient = this.getContainerClient(containerName);
            const tokenizedUrl = await containerClient.generateSasUrl(this.getSasOptions());
            const url = new URL(tokenizedUrl);
            token = url.search;
            this.tokenCache.addToken(containerName, token, Date.now() + SAS_TOKEN_CACHE_TTL);
        }
        return `https://${this.getStorageAccountHost()}/${containerName}/${blobName}${token}`;
    }

    async buildVideoUrl(
        containerName: string,
        blobName: string
    ): Promise<string> {
        return this.getSasUrl(containerName, blobName);
    }

    async buildImageUrl(
        binderId: string,
        visualId: string,
        formatName: string
    ) {
        const blobName = `/${binderId.substring(0, 4)}/${binderId.substring(4, 8)}/${binderId.substring(8)}/${visualId}/${formatName}`;
        return this.getSasUrl(this.container, blobName);
    }
}