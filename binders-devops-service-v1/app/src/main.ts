/* eslint-disable no-console */
import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { getProductionCluster, getStagingCluster } from "./actions/aks/cluster";
import { setupAccess, setupDevAccess } from "./service/aks/access";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DevopsServiceFactory } from "./service/service";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { devopsErrorHandler } from "./service/errorhandler";
import { getServiceRoutes } from "./service/routes";
import { isDev } from "./lib/environment";
import { isProduction } from "./lib/environment";
import { setupMonitor } from "./service/monitor";

const config = BindersConfig.get(60);

const run = async () => {
    // tslint:disable:no-console
    try {
        const name = "devops-v1";
        const logger = LoggerBuilder.fromConfig(config, name);
        const ldService = await LaunchDarklyService.create(config, LoggerBuilder.fromConfig(config))
        const devopsServiceFactory = new DevopsServiceFactory(ldService);
        const azClient = await BackendAuthorizationServiceClient.fromConfig(config, name);
        const devopsRoutes = getServiceRoutes(logger, azClient, devopsServiceFactory);
        const app = configureApi({
            routes: [[ "devops", "v1", devopsRoutes, devopsErrorHandler ]],
            config,
        });
        if (isDev()) {
            await setupDevAccess(config)
        } else {
            const clusterName = isProduction() ? getProductionCluster() : getStagingCluster()
            await setupAccess(config, clusterName);
        }
        startApp(app, 8016);
        setupMonitor(logger);
    } catch (error) {
        console.log("Could not start application.");
        console.log(error);
        process.exit(255);
    }
};

run();
