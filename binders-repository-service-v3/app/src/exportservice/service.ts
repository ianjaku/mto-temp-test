import {
    AuditLogExportPublicationFn,
    BindersRepositoryServiceContract
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BackendAccountServiceClient,
    BackendImageServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    BindersRepository,
    ElasticBindersRepository
} from "../repositoryservice/repositories/binderrepository";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    DefaultESQueryBuilderHelper,
    ESQueryBuilderHelper
} from "../repositoryservice/esquery/helper";
import {
    ExportServiceContract,
    IPDFExportOptions
} from "@binders/client/lib/clients/exportservice/v1/contract";
import { IOperationLog, OperationLogServiceFactory } from "../repositoryservice/operation-log";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    buildPublicationHTMLParts,
    exportPublicationAsPdf,
    getPublicationVisualsForPdfExport
} from "./pdf";
import {
    getEditorLocationForAccount,
    getReaderLocationForAccount,
    injectPath
} from "@binders/binders-service-common/lib/util/url";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Config } from "@binders/client/lib/config/config";
import { ES_MAX_RESULTS } from "../repositoryservice/const";
import {
    ElasticPublicationsRepository
} from "../repositoryservice/repositories/publicationrepository";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { Maybe } from "@binders/client/lib/monad";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import Translator from "../repositoryservice/translation/translator";
import { getBinderMasterLanguage } from "../repositoryservice/util";


export class ExportService implements ExportServiceContract {
    constructor(
        private readonly bindersRepository: BindersRepository,
        private readonly bindersRepoClient: BindersRepositoryServiceContract,
        private readonly routingServiceContract: RoutingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly accountServiceContract: AccountServiceContract,
        private readonly logger: Logger,
        private readonly translator: Translator,
        private readonly imageServiceHost: string,
    ) {
    }

    async docInfosCsv(accountId: string): Promise<string> {
        const binders = await this.bindersRepoClient.findBindersBackend({
            accountId,
            softDelete: { show: "show-non-deleted" }
        }, { maxResults: ES_MAX_RESULTS });
        const allActivePublications = await this.bindersRepoClient.findPublicationsBackend({
            accountId,
            isActive: 1,
        }, {
            maxResults: ES_MAX_RESULTS,
        });
        const editorLocation = await getEditorLocationForAccount(this.routingServiceContract, accountId);

        const escapeForCsv = (str: string): string => {
            if (!str) {
                return "";
            }
            const value = str.replace(/"/g, "\"\"").replace(/(\n|\\n)/g, " ").trim();
            return `"${value}"`;
        };
        const csvRows = await Promise.all(
            binders.map(async (binder) => {
                const publishedLangCodes = allActivePublications
                    .filter(p => p.binderId === binder.id)
                    .map(p => p.language.iso639_1);
                const masterLang = getBinderMasterLanguage(binder);
                const parts = [
                    binder.id,
                    masterLang.storyTitle,
                    (publishedLangCodes.join("-") || "none"),
                    `${editorLocation}/documents/${binder.id}`,
                ];
                return parts
                    .map(escapeForCsv)
                    .join(",");
            })
        );
        const csvWithHeaders = [
            "DocumentId,DocumentTitle,PublishedLanguages,ComposerLink",
            ...csvRows
        ]
        return csvWithHeaders.join("\n");
    }

    async colInfosCsv(accountId: string): Promise<string> {
        const collections = await this.bindersRepoClient.findCollections({
            accountId,
            softDelete: { show: "show-non-deleted" }
        }, { maxResults: ES_MAX_RESULTS });

        const readerLocation = await getReaderLocationForAccount(this.routingServiceContract, accountId);

        const escapeForCsv = (str: string): string => {
            if (!str) {
                return "";
            }
            const value = str.replace(/"/g, "\"\"").replace(/(\n|\\n)/g, " ").trim();
            return `"${value}"`;
        };

        const csvRows = collections.map((collection) => {
            // Get the first title (main language)
            const collectionTitle = collection.titles && collection.titles.length > 0 ?
                collection.titles[0].title :
                "";
            const parts = [
                collection.id,
                collectionTitle,
                injectPath(readerLocation, `/browse/${collection.id}`),
            ];
            return parts
                .map(escapeForCsv)
                .join(",");
        });

        const csvWithHeaders = [
            "CollectionId,CollectionTitle,CollectionLink",
            ...csvRows
        ]
        return csvWithHeaders.join("\n");
    }

    async exportPublication(
        publicationId: string,
        domain: string,
        timezone: string,
        options?: IPDFExportOptions,
        from?: "reader" | "editor",
        auditLog?: AuditLogExportPublicationFn,
        interfaceLanguage?: string,
    ): Promise<string> {
        if (typeof auditLog === "function") {
            const pub = await this.bindersRepoClient.getPublication(publicationId);
            auditLog(pub.binderId, pub.accountId, publicationId, options.languageCode);
        }
        return this.#buildPublicationPDF(
            publicationId,
            domain,
            timezone,
            false,
            options,
            interfaceLanguage,
        );
    }

    async getPdfExportOptionsForBinder(binderId: string, languageCode: string): Promise<IPDFExportOptions> {
        const binder = await this.bindersRepository.getBinder(binderId);
        if (!binder) {
            return undefined;
        }
        const meta = binder.modules.meta.find(d => d.iso639_1 === languageCode);
        return meta && meta["pdfExportOptions"];
    }

    async previewExportPublication(publicationId: string, domain: string, timezone: string, options?: IPDFExportOptions, interfaceLanguage?: string): Promise<string> {
        return this.#buildPublicationPDF(
            publicationId,
            domain,
            timezone,
            true,
            options,
            interfaceLanguage,
        );
    }

    async #buildPublicationPDF(
        publicationId: string,
        domain: string,
        timezone: string,
        isPreview: boolean,
        options?: IPDFExportOptions,
        interfaceLanguage?: string,
    ): Promise<string> {
        const [publication, branding, accounts] = await Promise.all([
            this.bindersRepoClient.getPublication(publicationId, { cdnnify: options?.cdnnify }),
            this.routingServiceContract.getBrandingForReaderDomain(domain),
            this.routingServiceContract.getAccountsForDomain(domain),
        ]);
        const accountId = [...accounts].pop()?.id;
        const accountSettings = await this.accountServiceContract.getAccountSettings(accountId);

        const visuals = await getPublicationVisualsForPdfExport(publication, this.imageServiceContract, this.logger, options);

        const { stylusOverrideProps } = branding;
        const { logger } = this;
        const translator = this.translator;
        let translationFn: (t: string) => Promise<string> = undefined;
        if (options && options.languageCode) {
            const fromLangCode = publication.language ? publication.language.iso639_1 : "en";
            const toLangCode = options.languageCode;
            translationFn = async (title) => {
                return translator
                    .withPreferredEngine(fromLangCode, toLangCode, accountSettings.mt)
                    .translate(
                        title.replace(/\n/g, " "),
                        fromLangCode,
                        toLangCode,
                        false,
                    );
            };
        }

        if (options.shouldRenderAdditionalChunk) {
            options.translateAdditionalChunk = async (langCode) => {
                const content = "<p>Made with <a href='https://manual.to' target='_blank'><span class='notranslate'>manual.to</span></a></p>";
                return translator
                    .withPreferredEngine("en", langCode, accountSettings.mt)
                    .translateWithFallbackToEnglish(content, "en", langCode, true);
            };
        }
        if (isPreview) {
            const publicationParts = await buildPublicationHTMLParts(
                publication,
                visuals,
                stylusOverrideProps,
                timezone,
                domain,
                options,
                logger,
                this.imageServiceHost,
                translationFn,
                true,
                interfaceLanguage,
            );
            return publicationParts.join("")
        }
        return await exportPublicationAsPdf(
            publication,
            visuals,
            stylusOverrideProps,
            timezone,
            domain,
            options,
            logger,
            this.imageServiceHost,
            translationFn,
            interfaceLanguage
        ) as unknown as string;  // The Buffer can't "really" be converted into a string
    }

}

export class PublicationRepositoryFactory {
    constructor(
        private readonly config: Config,
        private readonly logger: Logger,
        private readonly operationLogService: IOperationLog,
        private readonly queryBuilderHelper: ESQueryBuilderHelper,
    ) { }

    static async fromConfig(config: Config) {
        const loginOption = getMongoLogin("repository_service");
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        const featureFlagService = await LaunchDarklyService.create(config, topLevelLogger);
        const operationLogCollectionConfig = await CollectionConfig.promiseFromConfig(config, "operationlogs", loginOption);
        const operationLogServicesFactory = new OperationLogServiceFactory(operationLogCollectionConfig);
        const operationLogService = operationLogServicesFactory.build(featureFlagService, topLevelLogger);
        const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
        return new PublicationRepositoryFactory(
            config,
            topLevelLogger,
            operationLogService,
            queryBuilderHelper,
        );
    }

    forRequest(logger?: Logger) {
        return new ElasticPublicationsRepository(this.config, logger ?? this.logger, this.queryBuilderHelper, this.operationLogService);
    }

}

export class ExportServiceFactory {
    private queryBuilderHelper: ESQueryBuilderHelper;

    constructor(
        private readonly config: Config,
        private logger: Logger,
        private readonly bindersRepoClient: BindersRepositoryServiceContract,
        private readonly routingServiceContract: RoutingServiceContract,
        private readonly imageServiceContract: ImageServiceContract,
        private readonly accountServiceContract: AccountServiceContract,
        private readonly translator: Translator,
    ) {
        this.queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    }

    forRequest(request: { logger?: Logger }): ExportService {
        const bindersRepo = new ElasticBindersRepository(this.config, request.logger, this.queryBuilderHelper);
        return new ExportService(
            bindersRepo,
            this.bindersRepoClient,
            this.routingServiceContract,
            this.imageServiceContract,
            this.accountServiceContract,
            request.logger,
            this.translator,
            this.getImageServiceHost(this.config),
        );
    }

    static async fromConfig(config: Config): Promise<ExportServiceFactory> {
        const topLevelLogger = LoggerBuilder.fromConfig(config);
        const [
            backendRepoClient,
            routingServiceContract,
            imageServiceClient,
            accountServiceClient,
            translator,
        ] = await Promise.all([
            BackendRepoServiceClient.fromConfig(config, "export-service"),
            BackendRoutingServiceClient.fromConfig(config, "export-service"),
            BackendImageServiceClient.fromConfig(config, "export-service"),
            BackendAccountServiceClient.fromConfig(config, "export-service"),
            Translator.fromConfig(config),
        ]);
        return new ExportServiceFactory(
            config,
            topLevelLogger,
            backendRepoClient,
            routingServiceContract,
            imageServiceClient,
            accountServiceClient,
            translator,
        );
    }

    private getImageServiceHost(config: Config): string {
        const locationKey = BindersConfig.getServiceLocationKey("image");
        const imageService: Maybe<string> = config.getString(locationKey);
        if (!imageService.isJust()) {
            return "";
        }
        return imageService.get();
    }

}
