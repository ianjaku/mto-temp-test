import { isDev, isProduction, isStaging } from "./environment";
import { withProtocol } from "./uri";

export function getAccountDomain(domain: string): string {
    const matches = domain.match(/(.*)\.editor\.manual\.to/);
    return (matches && matches[1]) ?
        `${matches[1]}.manual.to` :
        domain;
}

export function getReaderLocation(domain: string, manualToLocationFromConfig?: string): string {
    if (isProduction()) {
        return domain && withProtocol(domain);
    }
    const host = manualToLocationFromConfig ||
        (typeof(window) !== "undefined" && window["bindersConfig"]["api"]["locations"]["manualto"]);
    return host && withProtocol(host);
}

export function getEditorLocation(domain?: string, devEditorLocation?: string): string {
    if (isProduction()) {
        const subDomain = domain && domain.indexOf(".manual.to") >= 0 ?
            domain.substring(0, domain.indexOf(".manual.to")) :
            domain;
        return `https://${subDomain ? `${subDomain}.` : ""}editor.manual.to`;
    }
    if (devEditorLocation) {
        return devEditorLocation;
    }
    const location = typeof(window) !== "undefined" && window["bindersConfig"]["api"]["locations"]["editor"];
    return location && withProtocol(location);
}

export function buildReaderItemUrl(
    itemKind: "publication" | "binder" | "collection",
    domain: string,
    itemId: string,
    readerLocation?: string,
): string {
    let action: string;
    switch (itemKind) {
        case "publication":
            action = "read";
            break;
        case "binder":
            action = "launch";
            break;
        default:
            action = "browse";
    }
    return `${getReaderLocation(domain, readerLocation)}/${action}/${itemId}${isDev() || isStaging() ? `?domain=${domain}` : ""}`;
}

export function buildEditorItemUrl(
    itemKind: "publication" | "binder" | "collection",
    domain: string,
    itemId: string,
    editorLocation?: string,
): string {
    const action = itemKind === "binder" ? "documents" : "browse";
    return `${getEditorLocation(domain, editorLocation)}/${action}/${itemId}${isDev() || isStaging() ? `?domain=${domain}` : ""}`;
}

export function isManualToDomain(candidate: string): boolean {
    return candidate.match(/^[a-zA-Z0-9-]+\.manual\.to$/) !== null;
}