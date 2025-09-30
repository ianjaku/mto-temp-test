import "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import * as fs from "fs";
import {
    configureWebApp,
    startApp
} from  "@binders/binders-service-common/lib/middleware/app";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    BackendAuthorizationServiceClient
} from  "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { SAMLSSOConfig } from "@binders/binders-service-common/lib/authentication/saml-sso/config";
import { WebAppConfig } from "@binders/binders-service-common/lib/middleware/config";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { requestValidation } from "./access";

const config = BindersConfig.get(60);

const assetsPath = "/assets";

const buildIndexTemplateVars = (request: WebRequest) => {
    const impersonation = request.cookies["impersonation"] || "{}";
    return Promise.resolve({
        impersonation: JSON.stringify(impersonation),
    });
};

const getPublicDir = () => {
    const oneUp = __dirname + "/../public";
    if (fs.existsSync(oneUp)) {
        return oneUp;
    }
    return __dirname + "/../../public";
};

async function start() {
    const [
        azClient,
        samlSSOConfig,
    ] = await Promise.all([
        BackendAuthorizationServiceClient.fromConfig(config, "editor"),
        SAMLSSOConfig.fromConfig(config, "editor"),
    ]);

    const publicDir = getPublicDir();

    const appConfig: WebAppConfig = {
        appName: "partners-v1",
        application: Application.PARTNERS,
        indexFile: fs.realpathSync(`${publicDir}/index.html`),
        indexPath: "*",
        assetsDir: fs.realpathSync(publicDir),
        assetsPath,
        requestValidation: requestValidation(assetsPath, azClient),
        buildIndexTemplateVars,
        samlSSOConfig,
    };

    const app = await configureWebApp(config, appConfig);
    startApp(app, 8019);
}

// eslint-disable-next-line no-console
start().catch(console.error);
