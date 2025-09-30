import {
    Application,
    NextFunction,
    RequestHandler,
    Response 
} from "express";
import { getClientIpHeaders, getClientIps } from "../../util/ip";
import { BackendRoutingServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "../../util/logging";
import { MultiCIDR } from "../cidr";
import { SHARED_ROUTES } from "@binders/client/lib/clients/routes";
import { WebRequest } from "../../middleware/request";
import { any } from "ramda";
import { getIPWhiteListsForDomain } from "./domains";
import { isProduction } from "@binders/client/lib/util/environment";

export class IPWhiteList {

    private multiCIDR: MultiCIDR;

    constructor(cidrs: string[], private domain: string, private logger: Logger) {
        try {
            this.multiCIDR = new MultiCIDR(cidrs);
        } catch (error) {
            this.logger.warn("Could not build cidr for domain", "network-whitelist", { cidrs, error, domain });
            this.multiCIDR = undefined;
        }
    }

    checkRequest(request: WebRequest, response: Response, next: NextFunction): void {
        if (this.multiCIDR === undefined) {
            return next();
        }
        const clientIps = getClientIps(request);
        const isAllowed = clientIps.reduce(
            (allowed, ip) => allowed || this.multiCIDR.contains(ip),
            false
        );
        if (isAllowed) {
            return next();
        }
        this.logger.warn(
            "Blocking access to domain",
            "network-whitelist",
            {
                domain: this.domain,
                clientIps,
                clientIpHeaders: getClientIpHeaders(request)
            }
        );
        response.status(401);
        response.send("Invalid client ip.");
        response.end();
    }
}

export const setupWhiteListing = (app: Application, config: Config): void => {
    const clientPromise = BackendRoutingServiceClient.fromConfig(config, "ip-whitelisting");
    const setItUp: RequestHandler = async (request: WebRequest, response: Response, next: NextFunction) => {
        try {
            if (request && request.path) {

                if (
                    any(
                        p => request.path.endsWith(SHARED_ROUTES[p].path),
                        Object.keys(SHARED_ROUTES)
                    )
                ) {
                    return next();
                }
            }
            const client = await clientPromise;
            const domainOverride = isProduction() ? undefined : (request.query["domain"] as string);
            const domain = domainOverride || (request.header("Host") as string);
            const cidrs = await getIPWhiteListsForDomain(domain, client);
            if (cidrs === undefined || cidrs.length === 0) {
                return next();
            }
            if (request.logger) {
                request.logger.info("http headers", "ip-whitelisting", {
                    headers: request.headers,
                    clientIp: request.header("x-client-ip")
                });
            }
            const whiteList = new IPWhiteList(cidrs, domain, request.logger);
            return whiteList.checkRequest(request, response, next);
        } catch (error) {
            return next(error);
        }
    };
    app.use(setItUp);
};
