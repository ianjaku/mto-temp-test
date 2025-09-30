import { Application } from "../clients/trackingservice/v1/contract";
import { getBindersConfig } from "../clients/config";

const hasWindow = typeof window !== "undefined";

const STAGING_DOMAIN = "staging.binders.media";
/**
* Domain for production services used internally deployed on *.binders.media
* In April 2025, that's
*   dashboard.binders.media
*   manage.binders.media
*/
const INTERNAL_PROD_DOMAIN = "binders.media";

export const isStaging = (): boolean =>
    process.env.BINDERS_ENV === "staging" || (hasWindow && getBindersConfig()?.isStaging);

export const isDev = (): boolean =>
    process.env.NODE_ENV === "development";

export const isProduction = (): boolean =>
    process.env.NODE_ENV === "production" && !isStaging();

export const isPreprod = (): boolean => {
    return process.env.BINDERS_ENV === "production" && process.env.K8S_NAMESPACE === "preprod"
}

export const getEnvironmentName = (): "dev" | "production" | "staging" | string => {
    if (isDev()) return "dev";
    if (isStaging()) return "staging";
    if (isProduction()) return "production";
    return getBindersEnv();
}

export const getBindersEnv = (): string => (
    process.env.BINDERS_ENV
);

export const getCookieDomain = (): string => {
    if (isDev()) {
        return undefined;
    }
    return isStaging() ? STAGING_DOMAIN : "manual.to";
}

export function getCookieDomainForApplication(app: Application): string | undefined {
    switch (app) {
        case Application.EDITOR:
        case Application.READER:
            return getCookieDomain();
        case Application.MANAGE:
        case Application.DASHBOARD:
        case Application.PARTNERS:
            if (isProduction()) return INTERNAL_PROD_DOMAIN;
            if (isStaging()) return STAGING_DOMAIN;
            return undefined;
    }
}
