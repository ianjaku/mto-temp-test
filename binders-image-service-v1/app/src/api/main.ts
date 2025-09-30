import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import {
    BackendAccountServiceClient,
    BackendImageServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { getExtraWebrequestProps, getImageServiceBuilder } from "./config";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventEmitter } from "events";
import { ImageServiceBuilder } from "./service";
import { createVideoProcessingRestartsCounter } from "@binders/binders-service-common/lib/monitoring/prometheus/videoProcessingRestart";
import { getServiceRoutes } from "./routes";
import imageErrorHandler from "./errorhandler";
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";

class Emitter extends EventEmitter { }
const emitter = new Emitter();

const logger = console;

/**
 * Add Error listener
 */
emitter.on("error", (err) => {
    logger.error("Unexpected error on emitter", err);
});

const config = BindersConfig.get(60);

const installPreMiddleware = (serviceBuilder: ImageServiceBuilder) => {
    return (app) => {
        app.use("*", function(req, res, next) {
            const {
                imageStorage,
                logoStorage,
                fontStorage,
            } = getExtraWebrequestProps(serviceBuilder, config, req);
            req.imageStorage = imageStorage;
            req.logoStorage = logoStorage;
            req.fontStorage = fontStorage;
            next();
        });
    };
};

const setupApp = (imageServiceBuilder: ImageServiceBuilder, authorizationServiceClient, imageClient, accountServiceClient, repoServiceClient) => {
    const imageRoutes = getServiceRoutes(imageServiceBuilder, authorizationServiceClient, accountServiceClient, repoServiceClient);
    const app = configureApi({
        routes: [
            [ "image", "v1", imageRoutes, imageErrorHandler ],
            [ "images", "v1", imageRoutes, imageErrorHandler ]
        ],
        config,
        installPreMWare: installPreMiddleware(imageServiceBuilder)
    });
    startApp(app, 8007);
    setupMongoIndexMonitor(imageClient);
};

const doIt = async () => {
    const [
        authorizationServiceClient,
        imageClient,
        accountServiceClient,
        repoServiceClient,
    ] = await Promise.all([
        BackendAuthorizationServiceClient.fromConfig(config, "image-service"),
        BackendImageServiceClient.fromConfig(config, "image-service"),
        BackendAccountServiceClient.fromConfig(config, "image-service"),
        BackendRepoServiceClient.fromConfig(config, "image-service"),
    ]);
    createVideoProcessingRestartsCounter()
    const imageService = await getImageServiceBuilder(config);
    setupApp(imageService, authorizationServiceClient, imageClient, accountServiceClient, repoServiceClient);
};

doIt().catch(error => {
    // eslint-disable-next-line no-console
    console.error("Could not start service.");
    // eslint-disable-next-line no-console
    console.error(error);
    process.abort();
});
