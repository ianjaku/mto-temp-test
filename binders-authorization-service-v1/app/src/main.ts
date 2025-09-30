import "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable no-console */
// eslint-disable-next-line sort-imports
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { AuthorizationServiceFactory } from "./authorization/service";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import authorizationErrorHandler from "./authorization/errorhandler";
import getServiceRoutes from "./authorization/routes";
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";

const config = BindersConfig.get(60);

Promise.all([
    AuthorizationServiceFactory.fromConfig(config),
    BackendAuthorizationServiceClient.fromConfig(config, "authorization-service")
])
    .then(async ([authorizationServiceFactory, authorizationClient]) => {
        const SERVICE_NAME = "authorization-service";
        const trackingServiceClient = await BackendTrackingServiceClient.fromConfig(config, SERVICE_NAME);
        const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SERVICE_NAME);
        const authRoutes = getServiceRoutes(authorizationServiceFactory, trackingServiceClient, accountServiceClient);
        const app = configureApi({
            routes: [[ "authorization", "v1", authRoutes, authorizationErrorHandler ]],
            config,
        });
        startApp(app, 8002);
        setupMongoIndexMonitor(authorizationClient);
    })
    .catch(error => {
        console.log("Could not start application.");
        console.log(error);
        process.exit(255);
    });

