/* eslint-disable sort-imports */
import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import {
    BINDER_COUNTER_LABEL,
    createHtmlSanitizerStrippedHtmlCounter
} from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import {
    ensureRepositoryServiceAliases,
    existsRepositoryServicesAliasses
} from "./elastic/aliases";
import { isPreprod, isStaging } from "@binders/client/lib/util/environment";
import { AutoMockLlmService, MockFeatureFlagService } from "./contentservice/mock";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BindersRepositoryServiceFactory } from "./repositoryservice/service";
import { CommentServiceFactory } from "./commentservice/service";
import { ContentServiceFactory } from "./contentservice/service";
import { ExportServiceFactory } from "./exportservice/service";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RoutingServiceFactory } from "./routingservice/service";
import contentErrorHandler from "./contentservice/errorhandler";
import {
    createDuplicateTextModulesConflictCounter
} from "@binders/binders-service-common/lib/monitoring/prometheus/duplicateTextModulesConflict";
import {
    createElasticCounters
} from "@binders/binders-service-common/lib/monitoring/prometheus/elasticMetrics";
import { ensureAllSettings } from "./elastic/settings/ensure";
import { ensureMappings } from "./elastic/mappings/ensureMapping";
import { getServiceRoutes as getCommentServiceRoutes } from "./commentservice/routes";
import { getServiceRoutes as getContentServiceRoutes } from "./contentservice/routes";
import { getServiceRoutes as getExportServiceRoutes } from "./exportservice/routes";
import { getServiceRoutes as getRepositoryServiceRoutes } from "./repositoryservice/routes";
import { getServiceRoutes as getRoutingServiceRoutes } from "./routingservice/routes";
import http from "http";
import repoErrorHandler from "./repositoryservice/errorhandler";
import routingErrorHandler from "./routingservice/errorhandler";
import { setupMongoIndexMonitor } from "@binders/binders-service-common/lib/mongo/indices/health";
import { shouldServiceBeMocked } from "@binders/binders-service-common/lib/testutils/util";

async function main() {
    const config = BindersConfig.get(60);
    http.globalAgent.maxFreeSockets = 4096;
    const logger = LoggerBuilder.fromConfig(config);

    logger.trace(`Starting repository service with BINDERS_MOCK_SERVICES=${process.env.BINDERS_MOCK_SERVICES}`, "repository-v3");

    const repoService = await BindersRepositoryServiceFactory.fromConfig(config);
    const exportServiceFactory = await ExportServiceFactory.fromConfig(config);
    const routingService = await RoutingServiceFactory.fromConfig(config);
    const contentService = shouldServiceBeMocked("aicontent") ?
        await ContentServiceFactory.fromDependencies({ llm: new AutoMockLlmService(), featureFlagService: new MockFeatureFlagService() }, config) :
        await ContentServiceFactory.fromConfig(config);
    const commentService = await CommentServiceFactory.fromConfig(config);
    const azClient = await BackendAuthorizationServiceClient.fromConfig(config, "repo-service");
    const accountClient = await BackendAccountServiceClient.fromConfig(config, "repo-service");
    const trackingClient = await BackendTrackingServiceClient.fromConfig(config, "repo-service");
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "repo-service");
    const launchDarklyService = await LaunchDarklyService.create(config, logger);

    const commentRoutes = getCommentServiceRoutes(
        commentService,
        logger,
        azClient,
        accountClient,
        repoService,
    );
    const contentRoutes = getContentServiceRoutes(
        contentService,
        azClient,
        accountClient,
    );
    const exportRoutes = getExportServiceRoutes(
        logger,
        azClient,
        exportServiceFactory,
        repoService,
        trackingClient,
        launchDarklyService,
    );
    const repoRoutes = getRepositoryServiceRoutes(
        logger,
        azClient,
        repoService,
        accountClient,
        trackingClient,
        launchDarklyService
    );
    const routingRoutes = getRoutingServiceRoutes(
        config,
        routingService,
        azClient,
        accountClient,
    );

    // On production settings are not applied because it causes downtime
    // (the index closed and reopened after the settings are applied)
    // Can be overridden by setting the env var BINDERS_ELASTIC_ALLOW_ENSURE_SETTINGS=allow
    await ensureAllSettings(config);
    // Make sure we have an index with the correct mapping
    await ensureMappings(config);
    if (isStaging() || isPreprod()) {
        await ensureRepositoryServiceAliases(config)
    } else {
        const exists = await existsRepositoryServicesAliasses(config)
        if (!exists) {
            throw new Error("Some aliases are missing");
        }
    }
    createElasticCounters();
    createHtmlSanitizerStrippedHtmlCounter(BINDER_COUNTER_LABEL);
    createDuplicateTextModulesConflictCounter();
    const app = configureApi({
        routes: [
            ["binders", "v3", repoRoutes, repoErrorHandler],
            ["comment", "v1", commentRoutes, repoErrorHandler],
            ["content", "v1", contentRoutes, contentErrorHandler],
            ["export", "v1", exportRoutes, repoErrorHandler],
            ["routing", "v1", routingRoutes, routingErrorHandler],
        ],
        config,
    });
    startApp(app, 8011);
    setupMongoIndexMonitor(repoClient);
}

// eslint-disable-next-line no-console
main().catch(console.error)
