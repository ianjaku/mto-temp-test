/* eslint-disable no-console */
import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import * as path from "path";
import {
    BackendAccountServiceClient,
    BackendRoutingServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserServiceFactory } from "./userservice/service"
import { getServiceRoutes } from "./userservice/routes"
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";
import userErrorHandler from "./userservice/errorhandler"

const config = BindersConfig.get(60);

Promise.all([
    UserServiceFactory.fromConfig(config),
    BackendAuthorizationServiceClient.fromConfig(config, "user-service"),
    BackendAccountServiceClient.fromConfig(config, "user-service"),
    BackendTrackingServiceClient.fromConfig(config, "user-service"),
    BackendUserServiceClient.fromConfig(config, "user-service"),
    BackendRoutingServiceClient.fromConfig(config, "user-service"),
]).then(([
    userServiceFactory,
    azClient,
    accClient,
    trackingClient,
    userClient,
    routingClient,
]) => {
    const defaultLogger = LoggerBuilder.fromConfig(config);
    const userRoutes = getServiceRoutes(
        userServiceFactory,
        azClient,
        accClient,
        trackingClient,
        routingClient,
        defaultLogger
    );
    const app = configureApi({
        routes: [
            ["user", "v1", userRoutes, userErrorHandler]
        ],
        config,
    });

    global["commonStaticRoot"] = path.join(path.resolve(__dirname), "../../../../binders-service-common-v1/assets");
    global["userStaticRoot"] = path.join(path.resolve(__dirname), "../../static");

    startApp(app, 8013);
    setupMongoIndexMonitor(userClient);
})
    .catch(error => {
        /* tslint:disable:no-console */
        console.log("Could not start service.");
        console.log(error);
        /* tslint:enable:no-console */
        process.abort();
    });
