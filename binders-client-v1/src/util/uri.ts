import { isDev } from "./environment";

export function withProtocol(url: string, options = { forceHttps: false }): string {
    if (!url) {
        return undefined;
    }
    const trimmed = url.trim();
    if (trimmed.startsWith("http")) {
        return trimmed;
    }
    const prefix = isDev() && !options.forceHttps ? "http://" : "https://";
    if (trimmed.startsWith("mailto:")) {
        return trimmed;
    }
    return `${prefix}${url}`;
}

export function trimSlashes(uriPart: string): string {
    let result = uriPart;
    while (result.startsWith("/")) {
        result = result.substring(1);
    }
    while (result.endsWith("/")) {
        result = result.substring(0, result.length - 1);
    }
    return result;
}

export function getQueryStringVariable(variable: string, query?: string): string {
    if (typeof window === "undefined") {
        return null;
    }
    query = query || window.location.search;
    const cleanedQuery = query.startsWith("?") ?
        query.slice(1, query.length) :
        query;
    const vars = cleanedQuery.split("&");
    for (let i = 0; i < vars.length; i++) {
        const pair = vars[i].split("=");
        if (decodeURIComponent(pair[0]) === variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return null;
}

export function containsUrlScheme(text: string): boolean {
    return /https?:\/\/.*/.test(text);
}