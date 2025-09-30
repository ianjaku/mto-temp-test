import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import {
    BackendAccountServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { configureApi, startApp } from "@binders/binders-service-common/lib/middleware/app";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import LaunchDarklyService from "@binders/binders-service-common/lib/launchdarkly/server";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { PublicApiServiceFactory } from "./public-api/service";
import apiErrorHandler from "./public-api/errorhandler";
import { getServiceRoutes } from "./public-api/routes";

const config = BindersConfig.get(60);
const logger = LoggerBuilder.fromConfig(config);

async function getRateLimiterValue() {
    try {
        const launchDarkly = await LaunchDarklyService.create(config, logger);
        return await launchDarkly.getFlag<number>(LDFlags.PUBLIC_API_RATE_LIMIT_VALUE);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`Error getting rate limiter value from LaunchDarkly flag ${LDFlags.PUBLIC_API_RATE_LIMIT_VALUE}`, e);
        return undefined;
    }
}

Promise.all([
    PublicApiServiceFactory.fromConfig(config, logger),
    BackendAccountServiceClient.fromConfig(config, "public-api-service"),
    BackendAuthorizationServiceClient.fromConfig(config, "public-api-service"),
    BackendTrackingServiceClient.fromConfig(config, "public-api-service")
])
    .then(async ([
        publicApiServiceFactory,
        accountClient,
        authorizationClient,
        trackingClient
    ]) => {
        const apiRoutes = getServiceRoutes(
            config,
            publicApiServiceFactory,
            accountClient,
            authorizationClient,
            trackingClient
        );
        const rateLimiterValue = await getRateLimiterValue();
        const app = configureApi({
            routes: [
                ["public-api", "v1", apiRoutes, apiErrorHandler],
                ["public", "v1", apiRoutes, apiErrorHandler]
            ],
            config,
            rateLimiterValue,
        });

        startApp(app, 8017);
    })
