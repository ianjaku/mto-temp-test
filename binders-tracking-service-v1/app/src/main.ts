import "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable no-console */
// eslint-disable-next-line sort-imports
import { BackendAccountServiceClient, BackendTrackingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient"
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging"
import { TrackingServiceFactory } from "./trackingservice/service"
import { createCspReportsCounter } from "@binders/binders-service-common/lib/monitoring/prometheus/cspMetrics";
import { createElasticCounters } from "@binders/binders-service-common/lib/monitoring/prometheus/elasticMetrics"
import { ensureAliases } from "./essetup/ensureAliases"
import { ensureIndexTemplates } from "./essetup/ensureIndexTemplates"
import { ensureMappings } from "./essetup/mappings/ensureMapping"
import { ensurePartialEventsCollection } from "./trackingservice/repositories/eventRepoMappingRepository"
import { getServiceRoutes } from "./trackingservice/routes"
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";
import trackingErrorHandler from "./trackingservice/errorhandler"

const config = BindersConfig.get(60);
const logger = LoggerBuilder.fromConfig(config);

const SERVICE_NAME = "tracking-service";


Promise.all([
    TrackingServiceFactory.fromConfig(config, logger),
    BackendAuthorizationServiceClient.fromConfig(config, SERVICE_NAME),
    BackendAccountServiceClient.fromConfig(config, SERVICE_NAME),
    BackendTrackingServiceClient.fromConfig(config, SERVICE_NAME),
    LaunchDarklyService.create(config, logger),
]).then(async ([
    trackingServiceFactory,
    azClient,
    accountClient,
    trackingClient,
    launchDarklyService,
]) => {
    const trackingRoutes = getServiceRoutes(trackingServiceFactory, azClient, accountClient, launchDarklyService);

    const existed = await ensureAliases(config); // make sure we have our stats alias
    await ensureIndexTemplates(config); // make sure we have our stats index template so dynamically created indices get referenced by above alias
    await ensureMappings(config, !existed); // Make sure we have an index with the correct mapping

    await ensurePartialEventsCollection(config, logger);
    const app = configureApi({
        routes:  [["tracking", "v1", trackingRoutes, trackingErrorHandler]],
        config,
    });
    createServiceCounters();
    startApp(app, 8012);
    setupMongoIndexMonitor(trackingClient);
})
    .catch(error => {
        console.log("Could not start application.");
        console.log(error);
        process.exit(255);
    });

const createServiceCounters = (): void => {
    createCspReportsCounter();
    createElasticCounters();
};
