import * as path from "path";
import { createProxyUrlForManifest } from "@binders/client/lib/clients/imageservice/v1/visuals";
        
const resolveRelativeToManiefstUrl = (originalUrl: string, relativeUrl: string) => {
    const url = new URL(originalUrl);
    url.pathname = path.resolve(url.pathname, "../", relativeUrl);
    return url.toString();
}

export const addTokenToUrl = (url: string, token: string): string => {
    if (token.startsWith("?")) {
        token = token.slice(1);
    }
    if (url.includes(token)) return url;
    if (url.includes("?")) {
        // If the url already has a token, we don't want to add another one
        if (url.includes("se=")) return url;
        return `${url}&${token}`;
    }
    return `${url}?${token}`;
}


export const rewriteManifest = (
    manifest: string,
    currentManifestUrl: string,
    token: string,
    baseUrl: string
): string => {
    const lines = manifest.split("\n");
    const newLines = lines.map(line => {
        if (line.trim().length === 0) return line;
        if (!line.startsWith("#")) {
            const url = resolveRelativeToManiefstUrl(currentManifestUrl, line.trim());
            return createProxyUrlForManifest(baseUrl, url, token);
        }
        if (/URI=".+"/i.test(line)) {
            // 3 regex groups, the part before the URI, the URI, and the part after the URI
            const matches = line.match(/(.*)URI="([^"]+)"(.*)/i);
            const url = matches[2]; // The second regex group is the URI
            const test = resolveRelativeToManiefstUrl(currentManifestUrl, url.trim());
            const proxiedUrl = createProxyUrlForManifest(baseUrl, test, token);
            // Add all the parts (from the regex groups) back together with a proxied url
            const proxiedLine = matches[1] + `URI="${proxiedUrl}"` + matches[3];
            return proxiedLine;
        }
        return line;
    });
    return newLines.join("\n");
}

