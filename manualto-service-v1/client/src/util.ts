import * as UAParser from "ua-parser-js";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { getBindersConfig } from "@binders/client/lib/clients/config";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { isProduction } from "@binders/client/lib/util/environment";
import { overrideReaderLanguages } from "./stores/actions/user";
import { selectLanguage } from "./binders/binder-loader";

export function getAndDispatchPreferredLanguages(userPreferences: UserPreferences): string[] {
    let readerLanguages: string[] = [];
    if (userPreferences && userPreferences.readerLanguages && userPreferences.readerLanguages.length > 0) {
        readerLanguages = userPreferences.readerLanguages;
    }
    const language = getQueryStringVariable("lang");
    const languages = language ? [language, ...readerLanguages] : readerLanguages;

    overrideReaderLanguages(languages);
    selectLanguage(language);
    return languages;
}

export const getReaderDomain = (): string => {
    const domainFromWindow =
        getBindersConfig().domain ||
        window.location.hostname;
    return isProduction() ?
        domainFromWindow :
        getQueryStringVariable("domain") || domainFromWindow;
}

export const isPlaceholderVisual = (url: string): boolean => {
    return url.indexOf("document-cover-default") !== -1;
}

function isDataUrl(url: string): boolean {
    return url.replace(/(\r\n|\n|\r)/gm, "").trim().startsWith("data:")
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const rewriteUrlIfProxy = (candidate: any, prop = "medium"): any => {
    const bindersConfig = getBindersConfig();
    if (bindersConfig.proxiedAPiPath) {
        let url;
        const proxyUrl = new URL(bindersConfig.proxiedAPiPath);
        const isCandidateString = (typeof candidate === "string");

        if (isDataUrl(isCandidateString ? candidate : candidate[prop])) {
            return candidate;
        }

        if (isCandidateString) {
            url = new URL(candidate);
        } else {
            url = new URL(candidate[prop]);
        }

        let newUrl;
        if (url.href === DEFAULT_COVER_IMAGE) {
            newUrl = `${bindersConfig.proxiedReaderPath}/assets/document-cover-default.png`;
        } else {
            url.host = proxyUrl.host;
            url.protocol = proxyUrl.protocol;
            url.pathname = `${proxyUrl.pathname}${url.pathname}`
            newUrl = url.href;
        }
        return isCandidateString ?
            newUrl :
            Object.assign(
                Object.create(Object.getPrototypeOf(candidate)),
                { ...candidate, [prop]: newUrl }
            );
    }
    return candidate;
}

export const getPathPrefix = (): string => getBindersConfig().pathPrefix || "";

export const isBrowsePath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath === "/" ||
        relativePath.endsWith(ManualToRoutes.BROWSE) ||
        relativePath.endsWith(`${ManualToRoutes.BROWSE}/`);
}

export const isBrowseSubpath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath.startsWith(ManualToRoutes.BROWSE);
}

export const getBrowsedCollection = (pathname: string): string => {
    const relativePath = withoutPathPrefix(pathname);
    if (!relativePath.startsWith(ManualToRoutes.BROWSE)) {
        throw new Error(`Not a browse path ${pathname}`);
    }
    const parts = relativePath.split("/").filter(p => !!p);
    // get rid of "browse"
    parts.shift();
    return parts.join("/");
}

export const isSearchPath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath.startsWith(ManualToRoutes.SEARCH);
}

export const isPreviewPath = (pathname: string): boolean => pathname.startsWith(ManualToRoutes.PREVIEW);

export const isBrowseOrReadPath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath.startsWith(ManualToRoutes.BROWSE) || relativePath.startsWith(ManualToRoutes.READ);
}

export const isLaunchPath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath.startsWith(ManualToRoutes.LAUNCH);
}

export const isReadPath = (pathname: string): boolean => {
    const relativePath = withoutPathPrefix(pathname);
    return relativePath.startsWith(ManualToRoutes.READ);
}

export const toFullPath = (
    relativePath: string,
    options?: {
        includeCurrentQueryString?: boolean;
    }): string => {
    const queryString = options?.includeCurrentQueryString ? window.location.search : "";
    return `${getPathPrefix()}${relativePath}${queryString}`;
}

export const withoutPathPrefix = (fullPath: string): string => {
    return fullPath.replace(getPathPrefix(), "");
}

export const isMobileDevice = (): boolean => {
    const uaParser = new UAParser();
    const { type } = uaParser.getDevice();
    return type === "mobile" || type === "tablet";
}

export const getPurePath = (fullPath: string, stopAtParent: boolean): string => {
    const relativePath = withoutPathPrefix(fullPath);
    const purePath = withoutActionPrefix(relativePath);
    if (stopAtParent) {
        const purePathParts = purePath.split("/").filter(p => !!p);
        purePathParts.pop();
        return purePathParts.join("/");
    }
    return purePath;
}

const withoutActionPrefix = (path: string): string => {
    for (const action of [`${ManualToRoutes.LAUNCH}/`, `${ManualToRoutes.PREVIEW}/`, `${ManualToRoutes.READ}/`]) {
        if (path.indexOf(action) > -1) {
            return path.replace(action, "");
        }
    }
    return path;
}
