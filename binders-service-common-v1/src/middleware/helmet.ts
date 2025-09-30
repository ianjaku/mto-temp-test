import { Request, RequestHandler } from "express";
import helmet, { type HelmetOptions } from "helmet";
import { Config } from "@binders/client/lib/config/config";
import { IProxyConfig } from "./config";
import { isProxiedRequest } from "../util/domains";

export interface Options {
    allowIFrames: (request: Request) => Promise<boolean>;
}

export const helmetMiddleware = (config: Config, helmetOptions: Partial<Options>): RequestHandler => {
    const proxyConfig = config.getObject<IProxyConfig>("proxy").getOrElse({} as IProxyConfig);
    return async (req , res, next) => {
        const contentSecurityPolicy = getContentSecurityPolicy(config);
        const allowIFrames = helmetOptions.allowIFrames ? (await helmetOptions.allowIFrames(req)) : false;
        const requestIsProxied = isProxiedRequest(req, proxyConfig);
        const options: HelmetOptions = {
            // We're not enabling CSP for our customer that is using a proxy
            // This is influenced by the fact that it's unsure whether they will continue being our customers
            contentSecurityPolicy: requestIsProxied ? false : contentSecurityPolicy,
            referrerPolicy: false,
            crossOriginOpenerPolicy: false,
            crossOriginResourcePolicy: false,
            originAgentCluster: false,
            ...(allowIFrames ? { frameguard: false } : {}),
        };
        return helmet(options) (req, res, next);
    }
}

const getContentSecurityPolicy = (config: Config): HelmetOptions["contentSecurityPolicy"] =>
    config.getObject<HelmetOptions["contentSecurityPolicy"]>("contentSecurityPolicy").getOrElse(false);
