import "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable no-console */
// eslint-disable-next-line sort-imports
import * as path from "path";
import {
    BackendAccountServiceClient,
    BackendCredentialServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CredentialServiceFactory } from "./credentialservice/service";
import credentialErrorHandler from "./credentialservice/errorhandler";
import { getServiceRoutes } from "./credentialservice/routes";
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";

const config = BindersConfig.get(60);

Promise.all([
    CredentialServiceFactory.fromConfig(config),
    BackendAuthorizationServiceClient.fromConfig(config, "credential-service"),
    BackendCredentialServiceClient.fromConfig(config, "credential-service"),
    BackendUserServiceClient.fromConfig(config, "credential-service"),
    BackendAccountServiceClient.fromConfig(config, "credential-service"),
    BackendTrackingServiceClient.fromConfig(config, "credential-service"),
]).then(([
    credentialServiceFactory,
    azClient,
    credentialClient,
    userServiceClient,
    accountServiceClient,
    trackingServiceClient
]) => {
    const credRoutes = getServiceRoutes(
        credentialServiceFactory,
        azClient,
        userServiceClient,
        accountServiceClient,
        trackingServiceClient
    );

    // Needed for emails to work
    global["commonStaticRoot"] = path.join(path.resolve(__dirname), "../../../../binders-service-common-v1/assets");

    const app = configureApi({
        routes: [[ "credential", "v1", credRoutes, credentialErrorHandler ]],
        config,
    });
    startApp(app, 8004);
    setupMongoIndexMonitor(credentialClient);

}).catch(error => {
    console.log("Could not start application.");
    console.log(error);
    process.exit(255);
});
