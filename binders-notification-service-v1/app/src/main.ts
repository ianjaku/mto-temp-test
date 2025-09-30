import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import * as http from "http";
import * as path from "path";
import {
    BackendAccountServiceClient, BackendNotificationServiceClient, BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { NotificationServiceFactory } from "./notificationservice/service";
import { getServiceRoutes } from "./notificationservice/routes";
import notificationErrorHandler from "./notificationservice/errorhandler";
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";

const config = BindersConfig.get(60);

http.globalAgent.maxFreeSockets = 4096;

Promise.all([
    NotificationServiceFactory.fromConfig(config),
    BackendAuthorizationServiceClient.fromConfig(config, "notification-service"),
    BackendAccountServiceClient.fromConfig(config, "notification-service"),
    BackendNotificationServiceClient.fromConfig(config, "notification-service", () => { return ;}),
    BackendTrackingServiceClient.fromConfig(config, "notification-service")
]).then(([
    notificationServiceFactory,
    azClient,
    accClient,
    notificationClient,
    trackingClient
]) => {
    const notificationRoutes = getServiceRoutes(
        notificationServiceFactory,
        azClient,
        accClient,
        trackingClient
    );

    const app = configureApi({
        routes: [
            [ "notification", "v1", notificationRoutes, notificationErrorHandler ]
        ],
        config,
        installCatchAllRoute: false,
    });

    global["commonStaticRoot"] = path.join(path.resolve(__dirname), "../../../../binders-service-common-v1/assets");
    startApp(app, 8010);
    setupMongoIndexMonitor(notificationClient);
});

