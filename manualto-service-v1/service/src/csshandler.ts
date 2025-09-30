import * as express from "express";
import * as path from "path";
import { NextFunction, Response } from "express";
import {
    REDIS_CSS_CACHE_VERSION,
    REDIS_CSS_PREFIX,
    redisKeys
} from "@binders/client/lib/branding/redisKeys";
import {
    ReaderCssProps,
    defaultReaderProps
} from "@binders/binders-service-common/lib/style/reader";
import { RedisClient, RedisClientBuilder } from "@binders/binders-service-common/lib/redis/client";
import {
    getLocalGoogleFontEntry,
    proxyGoogleFonts
} from "@binders/binders-service-common/lib/util/googlefonts";
import {
    APIReaderStyleRepository
} from "@binders/binders-service-common/lib/style/baseRepository";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { CssTemplateBuilder } from "@binders/binders-service-common/lib/style/cssTemplateBuilder";
import { Font } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RedisCssRepository } from "@binders/binders-service-common/lib/style/cssRepository";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { existsSync } from "fs";
import { getDomainFromRequest } from "@binders/binders-service-common/lib/util/domains";
import { uniq } from "ramda";

function buildClient(config: Config) {
    return <RedisClient>RedisClientBuilder.fromConfig(config, "css");
}

function getBaseStyleRepo(config: Config): Promise<APIReaderStyleRepository> {
    return BackendRoutingServiceClient.fromConfig(config, "reader").then(
        client => new APIReaderStyleRepository(defaultReaderProps, client)
    );
}

function buildBuilder(config: Config, cssTemplate: string): Promise<CssTemplateBuilder<ReaderCssProps>> {
    return getBaseStyleRepo(config).then(baseStyleRepo => new CssTemplateBuilder(baseStyleRepo, cssTemplate));
}

function buildCssRepo(config: Config, keyPrefix: string, cssTemplate: string) {
    const client = buildClient(config);
    return buildBuilder(config, cssTemplate).then(builder => {
        const cssRedisKeyPrefix = `${keyPrefix}${REDIS_CSS_CACHE_VERSION}-`;
        return new RedisCssRepository(client, cssRedisKeyPrefix, builder);
    });
}

const memoizedGetCssDirectory = () => {
    let cssDirectory;
    return () => {
        if (cssDirectory) {
            return cssDirectory;
        }
        const candidates = [
            path.join(__dirname, "../public"),
            path.join(__dirname, "../../public"),
        ];
        const dir = candidates.reduce(
            (reduced, candidate) => {
                if (reduced) {
                    return reduced;
                }
                if (existsSync(candidate)) {
                    return candidate;
                }
                return undefined;
            },
            undefined
        );
        if (dir === undefined) {
            throw new Error("Could not find CSS directory!");
        }
        cssDirectory = dir;
        return dir;
    };
}

export function cssHandler(config: Config, cssFile: string, cacheKey: string = cssFile.split(".").slice(0, -1).join()): express.RequestHandler {
    const prefix = `${REDIS_CSS_PREFIX}${redisKeys[cacheKey]}-`;
    const getCssDirectory = memoizedGetCssDirectory();
    return cssTemplateHandler(config, prefix, path.join(getCssDirectory(), cssFile));
}

function cssTemplateHandler(config: Config, redisPrefix: string, cssTemplate: string) {
    const repoPromise = buildCssRepo(config, redisPrefix, cssTemplate);
    return async (request: WebRequest, response: Response, next: NextFunction) => {
        try {
            const forceRebuild = process.env.NODE_ENV !== "production" || !!request.query["force"];
            const repo = await repoPromise;
            const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
            const css = await proxyGoogleFonts(await repo.get(domain, forceRebuild), request);
            response.setHeader("Content-Type", "text/css");
            response.setHeader("Content-Length", css.length.toString());
            response.send(css);
        }
        catch (error) {
            next(error);
        }
    };
}

export function testCss(config: Config, domain: string): Promise<string> {
    return buildCssRepo(config, `${REDIS_CSS_PREFIX}test-`, path.join(__dirname, "../public", "styles.css")).then(repo => repo.build(domain));
}

export function getFonts(overrides: Partial<ReaderCssProps>): [string, string, string] {
    const systemFont = overrides.systemFont ? overrides.systemFont : defaultReaderProps.systemFont;
    const titleFont = overrides.titleFont ? overrides.titleFont : defaultReaderProps.titleFont;
    const userFont = overrides.userFont ? overrides.userFont : defaultReaderProps.userFont;
    return [systemFont, titleFont, userFont];
}

export function getCustomFonts(
    overridesFonts: Partial<ReaderCssProps>,
    customFonts: Array<Font> = [],
    request: WebRequest
): string[] {
    const nonDefaultFonts = [
        overridesFonts.systemFont,
        overridesFonts.titleFont,
        overridesFonts.userFont
    ].filter(f => !!f);

    const uniqueFonts = uniq(nonDefaultFonts);

    const links = uniqueFonts.map(fontName => {
        const customFont = customFonts.find(font => font.name === fontName);
        return customFont ? customFont.fontFaceUrl : getLocalGoogleFontEntry(fontName, request);
    });
    return links;
}