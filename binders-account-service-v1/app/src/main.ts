import "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable no-console */
// eslint-disable-next-line sort-imports
import {
    BackendAccountServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { AccountServiceFactory } from "./accountservice/service"
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import accountErrorHandler from "./accountservice/errorhandler"
import getAccountRoutes from "./accountservice/routes"
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";

const config = BindersConfig.get(60);

Promise.all([
    AccountServiceFactory.fromConfig(config),
    BackendAccountServiceClient.fromConfig(config, "account-service"),
    BackendAuthorizationServiceClient.fromConfig(config, "account-service"),
    BackendTrackingServiceClient.fromConfig(config, "account-service"),
])
    .then(([accountServiceFactory, accountClient, azContract, trackingContract]) => {
        const accountRoutes = getAccountRoutes(accountServiceFactory, azContract, trackingContract);
        const app = configureApi({
            routes: [["account", "v1", accountRoutes, accountErrorHandler]],
            config,
        });
        startApp(app, 8001);
        setupMongoIndexMonitor(accountClient);
    })
    .catch(error => {
        console.log("Could not start application.");
        console.log(error);
        process.exit(255);
    });
