import {
    ACCOUNT_SERVICE_CACHE_OPTIONS,
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendNotificationServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { ImageServiceBuilder, ImageServiceRequestProps } from "./service";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { AzureFontStorage } from "../storage/fonts";
import { AzureItemStorage } from "../storage/azure/azureItemStorage";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BindersServiceClientConfig } from "@binders/client/lib/clients/config";
import { Config } from "@binders/client/lib/config/config";
import { Either } from "@binders/client/lib/monad";
import { MongoBinderVisualRepositoryFactory } from "./repositories/binderVisualRepository";
import { MongoVideoIndexerRepositoryFactory } from "./videoIndexerRepository";
import { MongoVisualProcessingJobsRepositoryFactory } from "./repositories/visualProcessingJobsRepository";
import { MultiStorage } from "../storage/multi";
import { RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import { SimplePrefixURlBuilder } from "./urls";
import { VideoStorageConfig } from "../storage/videoStorage";
import { buildBLOBConfig } from "../storage/azure/AzureBlobStorage";
import { buildS3Config } from "../storage/s3";

export const getImageServiceBuilder = async (config: BindersConfig, timeoutMs?: number): Promise<ImageServiceBuilder> => {
    const connectionOptions = timeoutMs ? { connectionSettings: { timeoutMs } } : undefined
    const SERVICE_NAME = "image-service";
    const toplevelLogger = LoggerBuilder.fromConfig(config, SERVICE_NAME);
    const loginOption = getMongoLogin("image_service");
    const { databaseName } = ACCOUNT_SERVICE_CACHE_OPTIONS;
    const imageCollectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption, connectionOptions);
    const videoIndexerCollectionConfig = await CollectionConfig.promiseFromConfig(config, "videoIndexer", loginOption);
    const visualProcessingJobsCollectionConfig = await CollectionConfig.promiseFromConfig(config, "visualProcessingJobs", loginOption);
    const imageEndpointPrefix = BindersServiceClientConfig.getVersionedPath(config, "image", "v1", { useExternalLocation: true });
    return new ImageServiceBuilder(
        new MongoBinderVisualRepositoryFactory(imageCollectionConfig, toplevelLogger),
        new MongoVideoIndexerRepositoryFactory(videoIndexerCollectionConfig, toplevelLogger),
        new MongoVisualProcessingJobsRepositoryFactory(visualProcessingJobsCollectionConfig, toplevelLogger),
        new SimplePrefixURlBuilder(imageEndpointPrefix),
        await BackendCredentialServiceClient.fromConfig(config, SERVICE_NAME),
        await BackendNotificationServiceClient.fromConfig(config, SERVICE_NAME, () => undefined),
        await BackendAccountServiceClient.fromConfig(config, SERVICE_NAME),
        config,
        RedisClientBuilder.fromConfig(config, databaseName),
    );
};

function eitherToError<T>(lr: Either<Error, T>, logger: Logger, errorMessage: string, category: string) {
    return lr.caseOf({
        left: error => {
            if (logger) {
                logger.error(errorMessage, category);
            }
            throw error;
        },
        right: v => v
    })
}

export const getExtraWebrequestProps = (
    serviceBuilder: ImageServiceBuilder,
    config: Config,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    req
): ImageServiceRequestProps => {
    const s3Config = eitherToError(
        buildS3Config(config, "s3.videos"),
        req.logger, "Could not load s3 videos bucket", "config"
    );

    const azureStagingConfig = buildBLOBConfig(config, "azure.images")
        .caseOf({
            left: () => {
                return eitherToError(
                    buildBLOBConfig(config, "azure.blobs.images"),
                    req.logger, "Could not load staging storage account", "config"
                );
            },
            right: cfg => cfg
        });

    const azureProductionConfig = buildBLOBConfig(config, "azure.images")
        .caseOf({
            left: () => {
                return buildBLOBConfig(config, "azure.blobs.images")
                    .caseOf({
                        left: () => {
                            if (req.logger) {
                                req.logger.info("Could not load production storage account");
                            }
                            return undefined
                        },
                        right: cfg => cfg
                    });
            },
            right: cfg => cfg
        });

    const azureLogoConfig = eitherToError(
        buildBLOBConfig(config, "azure.blobs.logos"),
        req.logger, "Could not load logo storage account", "config"
    );

    const videoLegacyStorageAccountName = config.getString("azure.blobs.videos.account").get();
    const videoLegacyStorageAccountKey = config.getString("azure.blobs.videos.accessKey").get();
    const videoLegacyStorageConfig: VideoStorageConfig = { accountKey: videoLegacyStorageAccountKey, accountName: videoLegacyStorageAccountName };

    const videoStorageAccountName = config.getString("azure.blobs.videos-v2.account").get();
    const videoStorageAccountKey = config.getString("azure.blobs.videos-v2.accessKey").get();
    const videoStorageConfig: VideoStorageConfig = { accountKey: videoStorageAccountKey, accountName: videoStorageAccountName };

    const service = serviceBuilder.build(req);
    const imageStorage = MultiStorage.default(
        req.logger,
        service,
        s3Config,
        videoStorageConfig,
        videoLegacyStorageConfig,
        azureStagingConfig,
        azureProductionConfig
    );
    const logoStorage = new AzureItemStorage("logos", req.logger, azureLogoConfig);
    const fontStorage = new AzureFontStorage(config, req.logger);

    return {
        imageStorage,
        logoStorage,
        fontStorage,
    };
}
