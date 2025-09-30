/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendImageServiceClient,
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CachingAncestorBuilder, ElasticAncestorBuilder } from "../repositoryservice/ancestors/ancestorBuilder";
import { ExportContentMode, IExportContentOptions } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { DimConsoleLogger } from "@binders/binders-service-common/lib/util/logging/dim";
import { ElasticCollectionsRepository } from "../repositoryservice/repositories/collectionrepository";
import { ElasticMultiRepository } from "../repositoryservice/repositories/multirepository";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { Maybe } from "@binders/client/lib/monad";
import PdfContentExporter from "../exportservice/contentexport/PdfContentExporter";
import { PrettyConsoleLogger } from "@binders/binders-service-common/lib/util/logging/pretty";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import Translator from "../repositoryservice/translation/translator";
import XmlDumpContentExporter from "../exportservice/contentexport/XmlDumpContentExporter";
import { buildSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { getBlobConfig } from "@binders/binders-service-common/lib/storage/azure_object_storage";
import { panic } from "@binders/client/lib/util/cli";

const config = BindersConfig.get();
const LOG_TAG = "export-content";

const doIt = async () => {
    const { itemId, mode, skipVisuals } = getOptions();

    const logger = DimConsoleLogger.fromConfig(config, "content-export");
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    const collectionRepository = new ElasticCollectionsRepository(config, logger, queryBuilderHelper);
    const repoAncestorBuilder = new ElasticAncestorBuilder(collectionRepository);
    const ancestorRedisClient = RedisClientBuilder.fromConfig(config, "documents")
    const cachingAncestorBuilder = new CachingAncestorBuilder(repoAncestorBuilder, ancestorRedisClient);
    const accountServiceContract = await BackendAccountServiceClient.fromConfig(config, LOG_TAG);
    const credentialServiceContract = await BackendCredentialServiceClient.fromConfig(config, LOG_TAG);
    const imageServiceContract = await BackendImageServiceClient.fromConfig(config, LOG_TAG);
    const multiRepository = new ElasticMultiRepository(config, logger, queryBuilderHelper);
    const publicationRepository = new ElasticPublicationsRepository(config, logger, queryBuilderHelper);
    const routingServiceContract = await BackendRoutingServiceClient.fromConfig(config, LOG_TAG);

    const exportBlobConfig = getBlobConfig(config, "export", logger);
    const imageServiceHost = getImageServiceHost(config);
    const jwtConfig = buildSignConfig(config);
    const translator = await Translator.fromConfig(config);

    const options: IExportContentOptions = { mode: mode === "pdf" ? ExportContentMode.pdf : ExportContentMode.xml };
    const exporter = options?.mode === ExportContentMode.pdf ?
        new PdfContentExporter(
            itemId,
            multiRepository,
            collectionRepository,
            accountServiceContract,
            routingServiceContract,
            imageServiceContract,
            publicationRepository,
            imageServiceHost,
            PrettyConsoleLogger.fromConfig(config, "pdf-export"),
            translator,
            cachingAncestorBuilder,
            jwtConfig,
            exportBlobConfig
        ) :
        new XmlDumpContentExporter(
            itemId,
            multiRepository,
            collectionRepository,
            accountServiceContract,
            PrettyConsoleLogger.fromConfig(config, "xml-export"),
            imageServiceHost,
            credentialServiceContract,
            imageServiceContract,
            exportBlobConfig,
            { skipVisuals },
        );
    await exporter.export();
};

const getOptions = () => {
    if (process.argv.length < 4 || !["pdf", "xml"].includes(process.argv[3])) {
        panic(`Usage: node ${__filename} <ITEM_ID> <MODE (pdf | xml)> <skipVisuals?>`);
    }
    return {
        itemId: process.argv[2],
        mode: process.argv[3],
        skipVisuals: process.argv[4] === "skipVisuals"
    };
};

function getImageServiceHost(config: BindersConfig): string {
    const locationKey = BindersConfig.getServiceLocationKey("image");
    const imageService: Maybe<string> = config.getString(locationKey);
    if (!imageService.isJust()) {
        return "";
    }
    return imageService.get();
}

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )
