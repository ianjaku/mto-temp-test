import {
    AccountServiceContract,
    FEATURE_MANUALTO_CHUNK,
    FEATURE_NOCDN
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    Binder,
    DocumentCollection,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ContentExporter, ContentExporterData } from "./ContentExporter";
import {
    DefaultUnitFormatter,
    Progress,
} from "@binders/client/lib/util/progress";
import {
    ItemsTransformer,
    multiTransformItems
} from "@binders/binders-service-common/lib/itemstransformers";
import {
    ReaderBranding,
    RoutingServiceContract
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { exportPublicationAsPdf, getPublicationVisualsForPdfExport } from "../pdf";
import { AncestorBuilder } from "../../repositoryservice/ancestors/ancestorBuilder";
import { Archiver } from "archiver";
import { CollectionRepository } from "../../repositoryservice/repositories/collectionrepository";
import { IAzureBlobConfig } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { IPDFExportOptions } from "@binders/client/lib/clients/exportservice/v1/contract";
import ImageFormatsTransformer from "@binders/binders-service-common/lib/itemstransformers/ImageFormats";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import InheritedThumbnailTransformer from "../../repositoryservice/itemstransformers/InheritedThumbnails";
import { JWTSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { MultiRepository } from "../../repositoryservice//repositories/multirepository";
import { PublicationRepository } from "../../repositoryservice//repositories/publicationrepository";
import Translator from "../../repositoryservice//translation/translator";
import { UrlToken } from "@binders/binders-service-common/lib/tokens";
import autobind from "class-autobind";
import { sanitizeFilename } from "./helpers";

type PdfContentExporterData = ContentExporterData & {
    domain: string;
    pdfExportOptions: IPDFExportOptions;
    branding?: ReaderBranding;
};

const LOG_TAG = "pdf-dump";

export default class PdfContentExporter extends ContentExporter {

    private progressPublications: Progress;
    private progressVisuals: Progress;
    private usedArchivePaths: string[];
    declare protected data: Promise<PdfContentExporterData>;

    constructor(
        protected rootItemId: string,
        protected multiRepository: MultiRepository,
        protected collectionRepository: CollectionRepository,
        protected accountServiceClient: AccountServiceContract,
        protected routingServiceClient: RoutingServiceContract,
        protected imageServiceContract: ImageServiceContract,
        protected publicationRepository: PublicationRepository,
        protected imageServiceHost: string,
        protected logger: Logger,
        protected translator: Translator,
        protected ancestorBuilder: AncestorBuilder,
        protected jwtConfig: JWTSignConfig,
        protected exportBlobConfig: IAzureBlobConfig
    ) {
        super(
            rootItemId,
            multiRepository,
            collectionRepository,
            accountServiceClient,
            logger,
            {
                useItemNamesAsDirs: true,
                processInstancesAsStandaloneBinders: true,
            },
            exportBlobConfig
        );
        this.data = this.populateAdditionalData();
        this.usedArchivePaths = [];
        this.progressPublications = Progress.empty();
        this.progressVisuals = Progress.empty();
        autobind(this);
    }

    private async populateAdditionalData(): Promise<PdfContentExporterData> {
        const data = await this.data;
        const domainFilters = await this.routingServiceClient.getDomainFiltersForAccounts([data.accountId]);
        const domain = (domainFilters || []).length ? domainFilters[0].domain : undefined;
        const accountFeatures = await this.accountServiceClient.getAccountFeatures(data.accountId);
        const accountSettings = await this.accountServiceClient.getAccountSettings(data.accountId);
        const branding = await this.routingServiceClient.getBrandingForReaderDomain(domain);
        return {
            ...data,
            domain,
            branding,
            pdfExportOptions: {
                shouldRenderAdditionalChunk: accountFeatures.includes(FEATURE_MANUALTO_CHUNK),
                cdnnify: !(accountFeatures.includes(FEATURE_NOCDN)),
                translateAdditionalChunk: (langCode) => this.translator
                    .withPreferredEngine("en", langCode, accountSettings.mt)
                    .translate(
                        "<p>Made with <a href='https://manual.to' target='_blank'><span class='notranslate'>manual.to</span></a></p>",
                        "en",
                        langCode,
                        true,
                    ),
                renderOnlyFirstCarrouselItem: accountSettings.pdfExport.renderOnlyFirstCarrouselItem,
            }
        };
    }

    private async getPublicationTransformers(publication: Publication, pdfExportOptions: IPDFExportOptions): Promise<ItemsTransformer[]> {
        const inheritedThumbnailTransformer = new InheritedThumbnailTransformer(
            this.ancestorBuilder,
            this.collectionRepository,
            this.jwtConfig,
            this.multiRepository,
        );
        const urlTokens: { [id: string]: UrlToken } = await UrlToken.buildMany([publication.binderId], this.jwtConfig, 1);
        const urlToken = urlTokens[publication.binderId] && urlTokens[publication.binderId].key;
        const imageFormatsTransformer = new ImageFormatsTransformer(
            this.imageServiceContract,
            this.jwtConfig,
            { cdnnify: pdfExportOptions.cdnnify, urlToken }
        );
        return [inheritedThumbnailTransformer, imageFormatsTransformer];
    }

    private async populateArchiveWithPublication(
        archiveStream: Archiver,
        publication: Publication,
        itemPath: string,
        options: { useLanguageInTitle: boolean },
    ): Promise<void> {

        const { useLanguageInTitle } = options;
        const { domain, pdfExportOptions, branding } = await this.data;

        const [transformedPublication] = await multiTransformItems(
            [publication],
            await this.getPublicationTransformers(publication, pdfExportOptions),
        ) as Array<Publication>;

        const visuals = await getPublicationVisualsForPdfExport(transformedPublication, this.imageServiceContract, this.logger, pdfExportOptions);
        this.progressVisuals = this.progressVisuals.incTotal(visuals.length).tickBy(visuals.length);

        const pdfBuffer = await exportPublicationAsPdf(
            transformedPublication,
            visuals,
            branding.stylusOverrideProps,
            undefined,
            domain,
            pdfExportOptions,
            this.logger,
            this.imageServiceHost,
        );

        const title = transformedPublication.language.storyTitle || publication.id;
        const sanitizedTitle = sanitizeFilename(title);
        const maybeLanguageSuffix = useLanguageInTitle ? `_${transformedPublication.language.iso639_1}` : "";
        const filename = `${sanitizedTitle}${maybeLanguageSuffix}`;
        const filepath = `${itemPath}${filename}`;
        const publicationPath = this.makeUniqueFilepath(filepath, publication.id);
        const name = `${publicationPath}.pdf`;
        archiveStream.append(pdfBuffer, { name });
        this.progressPublications = this.progressPublications.incTotal().tick();
    }

    private makeUniqueDirpath(itemPath: string, binderId: string) {
        const removeTrailingSlash = p => p.substring(0, p.length - 1);
        const path = (this.usedArchivePaths.includes(itemPath)) ?
            `${removeTrailingSlash(itemPath)}_${binderId}/` :
            itemPath;
        this.usedArchivePaths.push(path);
        return path;
    }

    private makeUniqueFilepath(itemPath: string, id: string) {
        const path = (this.usedArchivePaths.includes(itemPath)) ?
            `${itemPath}_${id}` :
            itemPath;
        this.usedArchivePaths.push(path);
        return path;
    }

    protected async populateArchiveWithBinder(
        archiveStream: Archiver,
        binder: Binder,
        itemPath: string,
    ): Promise<void> {
        this.logger.info(`Populating Archive with Binder ${binder.id}`, LOG_TAG);
        const publications = (await this.publicationRepository.find(
            {
                binderId: binder.id,
                isActive: 1,
            },
            {
                maxResults: 9999,
                omitContentModules: false,
                summary: false
            }
        )) as Publication[];

        const binderPath = this.makeUniqueDirpath(itemPath, binder.id);

        for await (const publication of publications) {
            this.logger.info(`Populating Archive with Publication ${publication.id}`, LOG_TAG);
            await this.populateArchiveWithPublication(
                archiveStream,
                publication,
                binderPath,
                { useLanguageInTitle: publications.length > 1 },
            );
        }
    }

    protected async populateArchiveWithCollection(
        archiveStream: Archiver,
        _collection: DocumentCollection,
        itemPath: string,
    ): Promise<void> {
        archiveStream.append("", { name: itemPath });
    }

    protected async populateArchiveWithInstanceRef(): Promise<void> {
        // not in use in this exporter
    }

    updateStatus(): void {
        const visualsUpdate = this.progressVisuals.formatDefault(unit => `${DefaultUnitFormatter(unit)} Vis`);
        const publicationsUpdate = this.progressPublications.formatDefault(unit => `${DefaultUnitFormatter(unit)} Pub`);
        this.logger.info(`Visuals:      ${visualsUpdate}`, "export-progress");
        this.logger.debug(`Publications: ${publicationsUpdate}`, "export-progress");
    }

}
