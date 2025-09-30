import { isDev, isProduction, isStaging } from "@binders/client/lib/util/environment";
import { WebRequest } from "../../middleware/request";
import { getAccountDomain } from "@binders/client/lib/util/domains";

export const getDomainForSSOSettings = (request: WebRequest): string => {
    if (request.body && request.body.RelayState) {
        return getSSODomainFromRelayState(request);
    }
    return isProduction() ?
        getAccountDomain(request.hostname) :
        (request.query.domain as string || getAccountDomain(request.hostname));
}

export const getDomainForSAMLResponse = (request: WebRequest): string => {
    if (isDev()) {
        return "saml.dev.binders.media";
    }
    return isStaging() ? request.hostname : getDomainForSSOSettings(request);
}

export const getAddressForRedirect = (request: WebRequest): string => {
    const domain = request.hostname;
    const suffix = request.session.redirectRoute || "";
    const withoutDomain = `https://${domain}${suffix}`;
    if (isProduction()) {
        return withoutDomain;
    } else {
        const domainParam = `domain=${getDomainForSSOSettings(request)}`;
        if (withoutDomain.includes("?")) {
            return `${withoutDomain}&${domainParam}`
        } else {
            return `${withoutDomain}?${domainParam}`
        }
    }
}

const getItemFromRelayState = (request: WebRequest, key: string): string => {
    const state = (request.body && request.body.RelayState) || "{}";
    const decoded = JSON.parse(state);
    return decoded[key];
}

export const getRedirectFromRelayState = (request: WebRequest): string => {
    return getItemFromRelayState(request, "redirectAddress") || "//";
}

export const getSSODomainFromRelayState = (request: WebRequest): string => {
    return getItemFromRelayState(request, "domainForSSOSettings") || request.hostname;
}

export const getAccountIdFromRelayState = (request: WebRequest): string => {
    return getItemFromRelayState(request, "accountId");
}