import { Allow, BackendUser } from "../middleware/authorization";
import {
    ApplicationTokenOrPublic,
    BackendToken,
    Public
} from  "../middleware/authentication";
import { SHARED_ROUTES } from "@binders/client/lib/clients/routes";
import { ServiceRoute } from "../middleware/app";
import { WebRequest } from "../middleware/request";
import bandwidthHandler from "./bandwidth";
import buildinfoHandler from "./buildinfo";
import echoHandler from "./echo";
import healtzHandler from "./healtz";
import memwatchHandler from "./memwatch";
import metricsHandler from "./metrics";
import whoAmIHandler from "./whoami";

const statusAccessControl = {
    authentication: Public,
    authorization: Allow
};
export const getSharedRoutes = (): {[routeName: string]: ServiceRoute} => {
    return {
        statusHealth: {
            ...SHARED_ROUTES["statusHealth"],
            serviceHandler: healtzHandler,
            ...statusAccessControl
        },
        statusBandwidth: {
            ...SHARED_ROUTES["statusBandwidth"],
            serviceHandler: bandwidthHandler,
            ...statusAccessControl
        },
        statusEcho: {
            ...SHARED_ROUTES["statusEcho"],
            serviceHandler: echoHandler,
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        statusEchoPost: {
            ...SHARED_ROUTES["statusEchoPost"],
            serviceHandler: echoHandler,
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        },
        statusMemwatch: {
            ...SHARED_ROUTES["statusMemwatch"],
            serviceHandler: memwatchHandler,
            authentication: BackendToken,
            authorization: BackendUser
        },
        statusMetrics: {
            ...SHARED_ROUTES["statusMetrics"],
            serviceHandler: metricsHandler,
            ...statusAccessControl
        },
        statusBuildInfo: {
            ...SHARED_ROUTES["statusBuildInfo"],
            serviceHandler: buildinfoHandler,
            ...statusAccessControl
        },
        statusWhoAmI: {
            ...SHARED_ROUTES["statusWhoAmI"],
            serviceHandler: whoAmIHandler,
            authentication: ApplicationTokenOrPublic,
            authorization: Allow
        }
    }
};

const SILENT_ROUTES = [
    "statusBuildInfo",
    "statusHealth",
    "statusMetrics",
] as const;
const SILENT_ROUTE_PATHS = SILENT_ROUTES.map(route => SHARED_ROUTES[route].path);

export const isSilentSharedEndpoint = (request: WebRequest): boolean =>
    SILENT_ROUTE_PATHS.some(silentRoutePath => request.url.endsWith(silentRoutePath))
