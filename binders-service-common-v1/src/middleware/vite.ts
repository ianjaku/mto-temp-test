/* eslint-disable no-console */
import * as ejs from "ejs";
import * as express from "express"
import * as fs from "node:fs/promises"
import { WebAppConfig, buildClientConfig } from "../middleware/config";
import { BindersConfig } from "../bindersconfig/binders";
import type { ViteDevServer } from "vite"
import type { WebRequest } from "../middleware/request";
import { configureWebApp } from "../middleware/app";
import { fileExists } from "../files/util";
import { join } from "path";
import sleep from "../util/sleep";

type ViteDevServerOptions = {
    base: string;
    hmrConfig: HmrConfig;
    indexHtmlFile: string;
    publicDir: string;
    webAppRoot: string;
    templateVars?: (req: WebRequest) => Promise<Record<string, unknown>>;
}
type HmrConfig = {
    /**
    * Host for the HMR server to bind on
    */
    hmrHost: string;
    /**
    * Port for the HMR server to listen on
    */
    hmrPort: number;
    /**
    * Port for the client app to access the HMR server
    */
    hmrClientPort: number;
}
export type WebAppDefinition = Pick<WebAppConfig,
    | "appName"
    | "application"
    | "assetsPath"
    | "backendSignConfig"
    | "buildIndexTemplateVars"
    | "cookieDomain"
    | "passportRouteConfigOverride"
    | "requestValidation"
>
export type WebAppOptions = Pick<WebAppConfig,
    | "assetsDir"
    | "assetsPath"
    | "createIndexHandler"
    | "indexFile"
    | "indexPath"
    | "skipServingStaticAssets"
>

export async function configureWebpack(
    config: BindersConfig,
    webAppConfig: WebAppDefinition,
    webpackOptions: {
        publicDir: string;
    },
) {
    console.log("Serving Webpack build")
    await waitForDirExists(webpackOptions.publicDir);
    const publicDir = webpackOptions.publicDir;
    const app = await configureWebApp(config, {
        ...webAppConfig,
        indexFile: join(publicDir, "/index.html"),
        indexPath: "*",
        assetsDir: publicDir,
        assetsPath: "/assets",
    });
    return app;
}

export async function configureViteProd(
    config: BindersConfig,
    webAppConfig: WebAppDefinition,
    viteProdOptions: { clientDistPath: string },
) {
    console.log("Serving Vite Production build")
    await waitForDirExists(viteProdOptions.clientDistPath);
    const distDir = viteProdOptions.clientDistPath;
    const app = await configureWebApp(config, {
        ...webAppConfig,
        indexFile: join(distDir, "index.html"),
        indexPath: "*",
        assetsDir: join(distDir, "assets"),
        assetsPath: "/assets",
    });
    return app;
}
export async function configureViteDev(
    config: BindersConfig,
    webAppDef: WebAppDefinition,
    viteDevOptions: {
        clientSrcDir: string;
        hmrConfig: HmrConfig;
        templateVars?: (req: WebRequest) => Promise<Record<string, unknown>>;
    },
) {
    console.log("Starting Vite Dev Server")
    const base = "/";
    const indexFile = join(viteDevOptions.clientSrcDir, "/vite/index.html")
    const publicDir = join(viteDevOptions.clientSrcDir, "public")
    const webAppRoot = viteDevOptions.clientSrcDir
    const app = await configureWebApp(config, {
        ...webAppDef,
        assetsDir: publicDir,
        assetsPath: "/assets/",
        indexFile,
        indexPath: "*",
        skipServingStaticAssets: true,
        createIndexHandler: (app, appConfig) =>
            createViteDevMiddleware(app, config, appConfig, {
                base,
                hmrConfig: viteDevOptions.hmrConfig,
                indexHtmlFile: indexFile,
                publicDir,
                webAppRoot,
                templateVars: webAppDef.buildIndexTemplateVars,
            }),
    });
    return app;
}

async function createViteDevMiddleware(
    app: express.Application,
    config: BindersConfig,
    appConfig: WebAppConfig,
    options: ViteDevServerOptions,
): Promise<(req: express.Request, res: express.Response) => Promise<void>> {
    const { createServer } = await import("vite");
    const vite = await createServer({
        server: {
            middlewareMode: true,
            hmr: {
                host: options.hmrConfig.hmrHost,
                port: options.hmrConfig.hmrPort,
                clientPort: options.hmrConfig.hmrClientPort,
            },
        },
        publicDir: options.publicDir,
        root: options.webAppRoot,
        appType: "custom",
        base: options.base,
        logLevel: "info",
    });
    app.use(vite.middlewares);
    app.set("vite", vite);
    if (appConfig.skipServingStaticAssets) {
        app.use(appConfig.assetsPath, express.static(appConfig.assetsDir));
    }
    return async (req: WebRequest, res: express.Response): Promise<void> => {
        try {
            const url = req.originalUrl.replace(options.base, "");
            const htmlTemplate = await fs.readFile(options.indexHtmlFile, "utf-8")
            const clientConfig = await buildClientConfig(appConfig, config, req, []);
            const templateVars = await options.templateVars?.(req) ?? {};
            const templateData = {
                config: JSON.stringify(clientConfig),
                proxyPath: clientConfig.pathPrefix,
                faviconUrl: null,
                ...templateVars,
            };
            const replaced = ejs.render(htmlTemplate, templateData, {});
            const renderedHtml = await vite.transformIndexHtml(url, replaced)
            res.status(200).set({ "Content-Type": "text/html" }).send(renderedHtml);
        } catch (e) {
            const vite = app.get("vite") as ViteDevServer;
            vite?.ssrFixStacktrace(e);
            // eslint-disable-next-line no-console
            console.log(e.stack);
            res.status(500).end(e.stack);
        }
    }
}

async function waitForDirExists(publicDir: string) {
    const SLEEP = 5000;
    while (!await fileExists(publicDir)) {
        await sleep(SLEEP);
        console.log(`Could  not find public folder at ${publicDir}, retrying in ${SLEEP / 1000}s...`);
    }
}
