import { ClientRequestArgs, OutgoingHttpHeaders } from "http";
import { NextFunction, Response } from "express";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BindersConfig } from "../bindersconfig/binders";
import { IProxyConfig } from "../middleware/config";
import { Logger } from "./logging";
import { WebRequest } from "../middleware/request";
import { getGoogleFontCss } from "../middleware/googleFontHandler";
import { getProxyConfig } from "./domains";
import { get as httpsGet } from "https";
import { isDev } from "@binders/client/lib/util/environment";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const url = require("url");

export interface IGoogleFontInfo {
    type: "css" | "icon";
    name: string;
    parameters?: string;
}

const googleFontsRegexp = /@import.url\(https?:\/\/fonts\.googleapis\.com\/(css|icon)\?family=([\w+]*)([^('|))]+)?/g;
const cssImportRegexp = /@import.url\(https?:\/\/fonts\.googleapis\.com\/(css|icon)\?family=([\w+]*)([^;]+);/i;

export async function proxyGoogleFonts(css: string, request: WebRequest): Promise<string> {
    const googleFontNames = getGoogleFontsNamesFromCss(css);
    for (const font of googleFontNames) {
        const googleFontCss = await getGoogleFontCss(font.name, font.type, font.parameters);
        const localGoogleFontEntry = getLocalGoogleFontEntry("", request);
        const googleFontWithLocalUrls = googleFontCss.replace(/https:\/\/fonts\.gstatic\.com\//g, localGoogleFontEntry)
        css = css.replace(cssImportRegexp, googleFontWithLocalUrls);
    }
    return css;
}

function getGoogleFontsNamesFromCss(css: string): IGoogleFontInfo[] {
    const fontsNames = [];
    let matches = [];
    while ((matches = googleFontsRegexp.exec(css)) !== null) {
        fontsNames.push({
            type: matches[1],
            name: matches[2],
            parameters: matches[3] ? matches[3].replace(/[:`);]/g, "") : undefined,
        });
    }
    return fontsNames;
}

const getAssetPath = (readerPath?: string): string => {
    return `${readerPath ?? ""}/assets/googlefonts`
}


const getLocationForFontsUrl = (request: WebRequest, app: Application): string => {
    if (isDev()) {
        const config = BindersConfig.get();
        const readerLocation = config.getString("services.manualto.externalLocation").getOrElse("");
        const editorLocation = config.getString("services.editor.externalLocation").getOrElse("");
        return app === Application.READER ?
            readerLocation :
            editorLocation;
    }
    return `https://${request.hostname}`;
}

const getLocalGoogleFontsUrlPrefix = (request: WebRequest, app: Application) => {
    const proxyInfix = request.proxyConfig ? request.proxyConfig.readerPath : ""
    const location = getLocationForFontsUrl(request, app);
    return `${location}${proxyInfix}${getAssetPath()}/`;
};


export const getLocalGoogleFontEntry = (
    fontName: string,
    request: WebRequest,
    app = Application.READER,
): string => {
    const prefix = getLocalGoogleFontsUrlPrefix(request, app);
    return `${prefix}${fontName}`;
}

const googleFontEntry = (logger: Logger) => {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    return async (request: WebRequest, response: Response, next: NextFunction) => {
        const fontName = request.params.fontName;
        if (!fontName) {
            next(new Error("Invalid font URL"));
            return;
        }
        const headers = { "User-Agent": request.header("user-agent") };
        try {
            const googleContent = await getGoogleFontContent(fontName, headers);
            response.header("Content-type", "text/css; charset=utf-8");
            response.send(googleContent);
            response.end();
        }
        catch(err) {
            logger.error(err, "google-font-entry");
            response.end();
        }
    };
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getGoogleFontContent = (
    fontName: string,
    headers?: OutgoingHttpHeaders,
    assetType: "css" | "icon" = "css",
    parameters = "400,700",
) => {
    const googleUrl = url.parse(`https://fonts.googleapis.com/${assetType}?family=${fontName}:${parameters}`);
    const requestOptions: ClientRequestArgs = {
        protocol: googleUrl.protocol,
        hostname: googleUrl.hostname,
        path: `${googleUrl.pathname}${googleUrl.search}`,
        headers,
    };
    const googleChunks = [];
    return new Promise((resolve, reject) => {
        httpsGet(requestOptions, (googleResponse) => {
            googleResponse.on("data", (chunk) => {
                googleChunks.push(chunk);
            });
            googleResponse.on("end", () => {
                const googleContent = googleChunks.join("");
                resolve(googleContent);
            });
        })
            .on("error", (error) => {
                reject(`Could not send font file ${error.toString()}`);
            });
    });
}

const googleFontProxy = (logger: Logger, proxyConfiguration: IProxyConfig) => {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    return (request: WebRequest, response: Response) => {
        getProxyConfig(request, proxyConfiguration).then((proxyConfig) => {
            const assetPath = getAssetPath(proxyConfig?.readerPath);
            if (!request.originalUrl.startsWith(assetPath)) {
                const errorMessage = "Invalid configuration, URL missmatch, expected " + request.originalUrl + " to start with " + assetPath;
                logger.error(errorMessage, "google-font-proxy");
                response.status(500);
                response.send(errorMessage);
                response.end();
                return;
            }
            const rewrittenUrl = request.originalUrl.substr(
                request.originalUrl.indexOf(assetPath) + assetPath.length,
            );
            const googleUrl = `https://fonts.gstatic.com${rewrittenUrl}`;
            httpsGet(googleUrl, googleResponse => googleResponse.pipe(response));
        });
    };
};

export default {
    entry: googleFontEntry,
    proxy: googleFontProxy
};
