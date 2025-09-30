import * as xmlBuilder from "xmlbuilder";
import { AzureObjectStorage, IAzureBlobConfig } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Archiver } from "archiver";
import { CollectionRepository } from "../../repositoryservice/repositories/collectionrepository";
import ContentCrawler from "./ContentCrawler";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MultiRepository } from "../../repositoryservice/repositories/multirepository";
import archiver from "archiver";
import { promises as fsPromises } from "fs";
import { join } from "path";
import moment from "moment";
import { tmpdir } from "os";


const LOG_TAG = "export-content";

export type ArchivePopulator = (archiveStream: Archiver) => Promise<void>;
export type ArchiveBinderPopulator = (archiveStream: Archiver, binder: Binder, itemPath: string) => Promise<void>;
export type ArchiveCollectionPopulator = (archiveStream: Archiver, collection: DocumentCollection, itemPath: string) => Promise<void>;
export type ArchiveInstancePopulator = (archiveStream: Archiver, itemId: string, itemPath: string) => Promise<void>;
export interface IContentExporterOptions {
    useItemNamesAsDirs?: boolean; // if false, use id's
    processInstancesAsStandaloneBinders?: boolean;
}

export interface StorageAccountSettings {
    account: string;
    key: string
}

export type ContentExporterData = {
    exportName: string;
    zipRoot: string;
    rootItemPath: string;
    accountId: string;
}
export abstract class ContentExporter {

    protected t: NodeJS.Timeout;
    protected startTime: moment.Moment;
    protected data: Promise<ContentExporterData>;

    constructor(
        protected rootItemId: string,
        protected multiRepository: MultiRepository,
        protected collectionRepository: CollectionRepository,
        protected accountServiceClient: AccountServiceContract,
        protected logger: Logger,
        protected contentExporterOptions: IContentExporterOptions = {},
        protected exportBlobConfig: IAzureBlobConfig,
    ) {
        this.t = setInterval(this.updateStatus.bind(this), 1000);
        this.populateData();
    }

    protected buildXmlDocument(xmlDocumentObj: { [name: string]: Record<string, unknown> }): string {
        return xmlBuilder.create(xmlDocumentObj, { encoding: "utf-8" }).end({ pretty: true });
    }

    protected buildInfoXml(durationMs: number, error?: Error | string): string {
        return this.buildXmlDocument({
            "manualto-export": {
                "@created": new Date().toISOString(),
                "@durationMs": durationMs,
                ...(error ? { "error": error } : {})
            }
        });
    }

    private async populateData() {
        // eslint-disable-next-line no-async-promise-executor
        this.data = new Promise(async (resolve, reject) => {
            try {
                const item = await this.multiRepository.getBinderOrCollection(this.rootItemId);
                const account = await this.accountServiceClient.getAccount(item.accountId);
                const exportName = `${account.id} (${account.name})/export_${this.rootItemId}_${moment().toISOString()}`;
                const zipRoot = "manualto-export/";
                const rootItemPath = `${zipRoot}${this.rootItemId}/`;
                resolve({
                    exportName,
                    zipRoot,
                    rootItemPath,
                    accountId: item.accountId,
                });
            } catch (err) {
                this.logger.error(err, LOG_TAG);
                reject(err);
            }
        });
    }

    private async streamArchiveToAzure(
        archivePopulator: ArchivePopulator,
    ): Promise<void> {
        const { exportName } = await this.data;
        const storage = new AzureObjectStorage(this.logger, this.exportBlobConfig, this.exportBlobConfig.container);

        await new Promise<void>((resolve, reject) => {
            const archiveStream = archiver("tar", {
                gzip: true,
                gzipOptions: { level: 5 }
            });
            archiveStream.on("warning", (err) => {
                this.logger.warn(`Warning during archiving export data ${err && err.message ? err.message : err}`, LOG_TAG);
            });
            archiveStream.on("error", (err) => {
                const msg = `Error during archiving export data ${err && err.message ? err.message : err}`;
                this.logger.error(msg, LOG_TAG);
                this.logger.logException(err, LOG_TAG);
                reject(err);
            });
            storage.uploadBlobFromStream(`${exportName}/export.tar.gz`, archiveStream)
                .then(resolve, reject);
            archivePopulator(archiveStream).then(() => {
                this.logger.info(`Finalized populator for ${exportName}`, LOG_TAG);
                archiveStream.finalize();
            });
        });
    }

    private async streamAdditionalDataToAzure(error?: Error): Promise<void> {
        const { exportName } = await this.data;
        const tmpFile = join(tmpdir(), `${exportName.replace(/\//g, "_")}_info.xml`);

        const durationMs = moment.duration(moment().diff(this.startTime)).asMilliseconds();
        const infoXml = this.buildInfoXml(durationMs, error?.message ?? error?.toString?.() ?? error);
        const storage = new AzureObjectStorage(this.logger, this.exportBlobConfig, this.exportBlobConfig.container);
        try {
            await fsPromises.writeFile(tmpFile, infoXml, "utf-8");
            this.logger.info(`Created local info.xml file ${tmpFile}`, LOG_TAG);
            await storage.uploadLocalFile(`${exportName}/info.xml`, tmpFile)
        } finally {
            fsPromises.unlink(tmpFile)
                .catch(err =>
                    this.logger.error(`Error deleting local info.xml file ${tmpFile}: ${err}`, LOG_TAG)
                );
        }
    }

    async export(): Promise<void> {
        try {
            let errorsSummary: Error;
            this.startTime = moment();
            const archivePopulator: ArchivePopulator = async (archiveStream) => {
                try {
                    this.logger.trace(`Starting populator for ${this.rootItemId}`, LOG_TAG);
                    const crawler = new ContentCrawler(
                        this.populateArchiveWithBinder,
                        this.populateArchiveWithCollection,
                        this.populateArchiveWithInstanceRef,
                        this.multiRepository,
                        this.collectionRepository,
                        this.contentExporterOptions,
                        this.logger,
                    );
                    const { errors } = await crawler.crawl(archiveStream, this.rootItemId);
                    this.logger.trace(`Finished populator for ${this.rootItemId}`, LOG_TAG);
                    errorsSummary = { name: "There were some errors during the export", message: errors.join(", ") };
                } catch (err) {
                    errorsSummary = err;
                    this.logger.error(`Failed populator for ${this.rootItemId}`, LOG_TAG);
                    this.logger.error(err, LOG_TAG);
                }
            };
            await this.streamArchiveToAzure(archivePopulator);
            await this.streamAdditionalDataToAzure(errorsSummary);
            clearInterval(this.t);
            this.logger.info(`Export of content for ${this.rootItemId} complete`, LOG_TAG);
        } catch (e) {
            this.logger.error(`Error during archiving export data ${e && e.message ? e.message : e}`, LOG_TAG);
            if (e.stack) this.logger.error(e.stack, LOG_TAG);
            throw e;
        }
    }

    protected abstract updateStatus(): void;
    protected abstract populateArchiveWithBinder(archiveStream: Archiver, binder: Binder, itemPath?: string): Promise<void>;
    protected abstract populateArchiveWithCollection(archiveStream: Archiver, collection: DocumentCollection, itemPath?: string): Promise<void>;
    protected abstract populateArchiveWithInstanceRef(archiveStream: Archiver, itemId: string, itemPath?: string): Promise<void>;
}
