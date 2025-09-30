import * as http from "http";
import * as https from "https";
import {
    Binder,
    DocumentCollection,
    Item
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DefaultUnitFormatter, Progress, } from "@binders/client/lib/util/progress";
import {
    ImageServiceContract,
    Visual
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    extractImageIdAndFormatFromUrl,
    fixDevUrl
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Archiver } from "archiver";
import { CollectionRepository } from "../../repositoryservice/repositories/collectionrepository";
import { ContentExporter } from "./ContentExporter";
import {
    CredentialServiceContract
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import {
    IAzureBlobConfig
} from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MultiRepository } from "../../repositoryservice/repositories/multirepository";
import TokenAcl from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import autobind from "class-autobind";
import { buildTokenUrl } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { getBinderLanguages } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { humanizeBytes } from "@binders/client/lib/util/formatting";

const LOG_TAG = "xml-dump"
const visualNamesToIgnore = ["document-cover-default"];

export default class XmpDumpContentExporter extends ContentExporter {

    private visuals: Visual[];
    private instanceLocations: Map<string, string>;
    private progressPublications: Progress;
    private progressVisuals: Progress;
    private totalVisualBytes: number;

    constructor(
        protected rootItemId: string,
        protected multiRepository: MultiRepository,
        protected collectionRepository: CollectionRepository,
        protected accountServiceClient: AccountServiceContract,
        protected logger: Logger,
        private imageServiceHost: string,
        private credentialServiceClient: CredentialServiceContract,
        private imageServiceClient: ImageServiceContract,
        protected azureBlobConfig: IAzureBlobConfig,
        private options = { skipVisuals: false },
    ) {
        super(
            rootItemId,
            multiRepository,
            collectionRepository,
            accountServiceClient,
            logger,
            {},
            azureBlobConfig,
        );
        this.visuals = [];
        this.instanceLocations = new Map<string, string>();
        this.progressVisuals = Progress.empty();
        this.progressPublications = Progress.empty();
        this.totalVisualBytes = 0;
        autobind(this);
    }

    private async sleep(timeoutInMs: number) {
        return new Promise(resolve => setTimeout(resolve, timeoutInMs))
    }

    private toDownloadOriginalUrl(url: string) {
        if (url.indexOf("azureedge") === -1) {
            const fixedUrl = fixDevUrl(url, this.imageServiceHost, false);
            return `${fixedUrl}?forceDownload=true`;
        }
        return url;
    }

    private nodeFromBinderVisualId(id: string) {
        const serviceVisual = this.visuals.find(v => v.id === id);
        const extension = serviceVisual && serviceVisual.extension;
        const src = `${id}${extension ? `.${extension}` : ""}`
        const type = id.startsWith("img-") ?
            "image" :
            "video";
        return {
            "@type": type,
            "@src": src,
        }
    }

    private buildInstanceXml(itemId: string) {
        return this.buildXmlDocument({
            "instance": {
                "@id": itemId,
                "location": this.instanceLocations.get(itemId),
            }
        });
    }

    private async streamVisualToArchive(
        visual: Visual,
        archiveStream: Archiver,
        itemPath: string,
        urlToken: string
    ): Promise<void> {
        const { formatUrls, extension, id } = visual;
        const downloadUrl = this.toDownloadOriginalUrl(formatUrls.find(f => f.name === "ORIGINAL").url);
        const downloadUrlWithToken = buildTokenUrl(downloadUrl, urlToken);
        await new Promise((resolve, reject) => {
            const request = (downloadUrlWithToken.startsWith("http:") ? http : https).get(downloadUrlWithToken, response => {
                archiveStream.append(response, { name: `${itemPath}${id}.${extension}` });
                response.on("error", (error) => {
                    reject(new Error(`${id} response stream emitted error ${error.message}`));
                });
                response.on("data", (chunk) => {
                    this.totalVisualBytes += chunk.length;
                });
            });
            request.on("finish", () => {
                resolve({
                    id,
                    extension,
                });
            });
            request.on("response", response => {
                if (response.statusCode >= 300) {
                    reject(new Error(`${id} request of http(s).get of visual url emitted response with status ${response.statusCode} : ${extension} ${id}`));
                }
            });
            request.on("error", (error) => {
                reject(new Error(`${id} request of http(s).get of visual url emitted error ${error.message}`));
            })
        });
        // without this sleep, the process' memory consumption gradually increases until it stagnates (didn't test lower values)
        await this.sleep(500);
    }

    private xmlFromCollection(collection: DocumentCollection) {
        const xmlDocumentObj = {
            "col": {
                "@id": collection.id,
                "titles": [],
                "thumbnail": undefined,
            }
        }
        const titleNodes = collection.titles.map(({ languageCode, title }) => ({
            text: {
                "@language": languageCode,
                "#text": title
            }
        }));
        xmlDocumentObj.col.titles = titleNodes;
        const { thumbnail: { medium } } = collection;
        if (!visualNamesToIgnore.some(n => medium.includes(n))) {
            const [thumbnailVisualId] = extractImageIdAndFormatFromUrl(medium);
            xmlDocumentObj.col.thumbnail = this.nodeFromBinderVisualId(thumbnailVisualId);
        }
        return this.buildXmlDocument(xmlDocumentObj);
    }

    private xmlFromBinder = (binder: Binder) => {
        const xmlDocumentObj = {
            "doc": {
                "@id": binder.id,
                "titles": [],
                "chunks": { chunk: [] },
            }
        }
        const { titleNodes, chunkNodes } = getBinderLanguages(binder).reduce((reduced, languageSpec, i) => {
            const { iso639_1: languageCode, modules, storyTitle, isDeleted } = languageSpec;
            const [moduleKey] = modules;
            const { titleNodes, chunkNodes } = reduced;
            titleNodes.push({ text: { "@language": languageCode, "@isDeleted": isDeleted, "#text": storyTitle } });
            const { chunks: textModuleChunks } = binder.modules.text.chunked.find(m => m.key === moduleKey);
            const { chunks: imageModuleChunks } = binder.modules.images.chunked[0];
            if (i === 0) {
                textModuleChunks.forEach((_, j) => {
                    const chunkNode = { "@index": `${j + 1}`, markup: [] };
                    const visualNodeArr = imageModuleChunks[j].map(v => this.nodeFromBinderVisualId(v.id));
                    chunkNode["visual"] = visualNodeArr;
                    chunkNodes.push(chunkNode);
                });
            }
            textModuleChunks.forEach((markup, j) => {
                chunkNodes[j].markup.push({ "@language": languageCode, "@isDeleted": isDeleted, "#cdata": markup });
            });
            return {
                titleNodes,
                chunkNodes,
            };
        }, {
            titleNodes: [],
            chunkNodes: [],
        });
        xmlDocumentObj.doc.titles = titleNodes;
        xmlDocumentObj.doc.chunks = { chunk: chunkNodes };
        return this.buildXmlDocument(xmlDocumentObj);
    }

    private async populateArchiveWithVisuals(archiveStream: Archiver, item: Item, itemPath: string) {
        const urlToken = await this.credentialServiceClient.createUrlToken(TokenAcl.fromItemIds([item.id]), 1);
        const visuals = await this.imageServiceClient.listVisuals(item.id, { cdnnify: true });
        if (!(visuals.length)) {
            return;
        }
        this.progressVisuals = this.progressVisuals.incTotal(visuals.length);
        for (const visual of visuals) {
            try {
                await this.streamVisualToArchive(visual, archiveStream, itemPath, urlToken);
                this.progressVisuals = this.progressVisuals.tick();
            } catch (error) {
                this.logger.error(error.message, LOG_TAG);
                this.progressVisuals = this.progressVisuals.tickFailed();
            }
        }
    }

    protected async populateArchiveWithBinder(
        archiveStream: Archiver,
        binder: Binder,
        itemPath: string,
    ): Promise<void> {
        this.logger.info(`Populating Archive with Binder ${binder.id}`, LOG_TAG);
        if (!this.options.skipVisuals) {
            await this.populateArchiveWithVisuals(archiveStream, binder, itemPath);
        }
        this.progressPublications = this.progressPublications.incTotal().tick();
        archiveStream.append(this.xmlFromBinder(binder), { name: `${itemPath}doc.xml` });
    }

    protected async populateArchiveWithCollection(
        archiveStream: Archiver,
        collection: DocumentCollection,
        itemPath: string,
    ): Promise<void> {
        this.logger.info(`Populating Archive with Collection ${collection.id}`, LOG_TAG);
        if (!this.options.skipVisuals) {
            await this.populateArchiveWithVisuals(archiveStream, collection, itemPath);
        }
        archiveStream.append(this.xmlFromCollection(collection), { name: `${itemPath}col.xml` });
    }

    protected async populateArchiveWithInstanceRef(
        archiveStream: Archiver,
        itemId: string,
        itemPath: string,
    ): Promise<void> {
        this.logger.info(`Populating Archive with InstanceRef ${itemId}`, LOG_TAG);
        archiveStream.append(this.buildInstanceXml(itemId), { name: `${itemPath}instance.xml` });
    }

    updateStatus(): void {
        const visualsUpdate = this.progressVisuals.formatDefault(unit => `${DefaultUnitFormatter(unit)} Vis`);
        const publicationsUpdate = this.progressPublications.formatDefault(unit => `${DefaultUnitFormatter(unit)} Pub`);
        this.logger.info(`Visuals:      ${visualsUpdate} (${humanizeBytes(this.totalVisualBytes)} streamed in total)`, "export-progress");
        this.logger.debug(`Publications: ${publicationsUpdate}`, "export-progress");
    }
}
