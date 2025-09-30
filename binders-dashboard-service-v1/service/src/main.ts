import "@binders/binders-service-common/lib/monitoring/apm";
/* eslint-disable no-console */
// eslint-disable-next-line sort-imports
import * as fs from "fs";
import {
    WebAppDefinition,
    configureViteDev,
    configureViteProd,
    configureWebpack,
} from "@binders/binders-service-common/lib/middleware/vite";
import { getPort, startApp } from "@binders/binders-service-common/lib/middleware/app";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Application as ExpressApplication } from "express";
import { buildBackendSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { getCookieDomainForApplication } from "@binders/client/lib/util/environment";
import { requestValidation } from "./access";

const PORT = getPort() || 8014;

async function start() {
    const config = BindersConfig.get();
    let app: ExpressApplication;

    const webAppDef: WebAppDefinition = {
        appName: "dashboard",
        assetsPath: "/assets/",
        application: Application.DASHBOARD,
        backendSignConfig: buildBackendSignConfig(config),
        cookieDomain: getCookieDomainForApplication(Application.DASHBOARD),
        requestValidation: requestValidation(
            await BackendAuthorizationServiceClient.fromConfig(config, "dashboard"),
            { publicPath: "/assets" },
        ),
        passportRouteConfigOverride: {
            loginTemplateFile: null,
        },
    };

    if (process.argv.includes("--vite-prod")) {
        app = await configureViteProd(config, webAppDef, {
            clientDistPath: __dirname + "/../www",
        });
    } else if (process.argv.includes("--vite-dev")) {
        app = await configureViteDev(config, webAppDef, {
            clientSrcDir: fs.realpathSync(__dirname + "/../../../client"),
            hmrConfig: {
                hmrHost: "0.0.0.0",
                hmrPort: 8095,
                hmrClientPort: 30095,
            },
        });
    } else {
        app = await configureWebpack(config, webAppDef, {
            publicDir: __dirname + "/../../public",
        });
    }
    startApp(app, PORT);
}

start().catch(console.error)

