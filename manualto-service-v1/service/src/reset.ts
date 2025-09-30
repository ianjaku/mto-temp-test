import * as ejs from "ejs";
import * as express from "express";
import * as fs from "fs";
import { findAccountIdByUserIdAndDomain, getDomainFromRequest, getHostnameForRequest } from  "@binders/binders-service-common/lib/util/domains";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BackendRoutingServiceClient } from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CredentialServiceContract } from  "@binders/client/lib/clients/credentialservice/v1/contract";
import { IProxyConfig } from  "@binders/binders-service-common/lib/middleware/config";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TokenVerifier } from "@binders/binders-service-common/lib/tokens";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { extractInterfaceLanguageFromRequest } from  "@binders/binders-service-common/lib/util/i18n";
import { findUserByToken } from "@binders/binders-service-common/lib/tokens/helpers";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";
import { isProduction } from "@binders/client/lib/util/environment";

const config = BindersConfig.get(60);
const resetPasswordTemplateFile = () => fs.realpathSync("./public/reset.html");
let memoizedResetPasswordFileContents = undefined;
const resetPasswordFileContents = () => {
    if (!memoizedResetPasswordFileContents) {
        memoizedResetPasswordFileContents = fs.readFileSync(resetPasswordTemplateFile(), "utf8");
    }
    return memoizedResetPasswordFileContents;
};

async function renderResetPasswordTemplate(
    request: WebRequest,
    userId: string,
    login: string,
    displayName: string,
    token: string,
    language: string,
    // TODO MT-4121 domain is not used in reset.html
    domain: string,
    hostname: string,
    _proxyConfig: IProxyConfig,
    isConsumed: boolean,
    isExpired: boolean
) {
    const contents = isProduction() ?
        resetPasswordFileContents() :
        fs.readFileSync(resetPasswordTemplateFile(), "utf8");
    const routingBackendClient = await BackendRoutingServiceClient.fromConfig(config, "reader");
    const branding = await routingBackendClient.getBrandingForReaderDomain(domain);
    const interfaceLang = await extractInterfaceLanguageFromRequest(request, { domain });
    const templateData = {
        branding: JSON.stringify(branding.stylusOverrideProps),
        brandingOverride: domain,
        language,
        userData: JSON.stringify({
            userId,
            login,
            displayName,
            token,
            isConsumed,
            isExpired,
            interfaceLang,
        }),
        domain,
        hostname,
    };
    return ejs.render(contents, templateData, {});
}

export function resetPasswordGet(
    verifier: TokenVerifier,
    userServiceClient: UserServiceContract,
    proxyConfig: IProxyConfig,
    credentialServiceClient: CredentialServiceContract
) {
    return async function (request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const receivedToken = request.params.token;
            const userOrError = await findUserByToken(receivedToken, verifier, userServiceClient, credentialServiceClient, request.logger);
            if (userOrError.type === "error") {
                request.logger?.error(userOrError.msg, "password-reset");
                next();
                return;
            }
            const { user, token, tokenIsExpired, tokenIsConsumed } = userOrError;
            try {
                const hostname = getHostnameForRequest(request, Application.READER);
                // TODO MT-4121 domain is not used in reset.html
                const domain = getDomainFromRequest(request, Application.READER, { returnOnlySubdomain: false });
                const responseData = await renderResetPasswordTemplate(
                    request,
                    user.id,
                    user.login,
                    user.displayName,
                    token,
                    request.query["l"] as string,
                    // TODO MT-4121 domain is not used in reset.html
                    domain,
                    hostname,
                    proxyConfig,
                    tokenIsConsumed,
                    tokenIsExpired,
                );
                response.send(responseData);
            } catch (err) {
                request.logger?.error(`Failed to render reset password template for token: ${token}`, "password-reset");
                // eslint-disable-next-line no-console
                console.error(err);
                next();
                return;
            }
        }
        catch (err) {
            next(err);
        }
    };
}

export function resendResetPasswordPost(userServiceClient: UserServiceContract) {
    return async function (request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const { login } = request.body;
            await userServiceClient.sendMePasswordResetLink(login, Application.READER)
            finishRequest(request, response, 200, {});
        } catch (err) {
            next(err);
        }
    };
}

export function resetPasswordPost(
    _verifier: TokenVerifier,
    userServiceClient: UserServiceContract,
    credentialClient: CredentialServiceContract,
    routingServiceContract: RoutingServiceContract,
    accountServiceContract: AccountServiceContract,
) {
    return async function (request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const token = request.params.token;
            const { displayName, newPassword, domain } = request.body;
            const session = await credentialClient.loginWithToken(token);
            const userId = session.userId;
            const user = await userServiceClient.getUser(userId)
            const accountId = await findAccountIdByUserIdAndDomain(userId, domain, routingServiceContract, accountServiceContract);
            const updatedUser = await userServiceClient.updateUser(Object.assign({}, user, { displayName}), accountId);
            const updatedSession = await credentialClient.resetPassword(token, updatedUser.login, newPassword, accountId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (request as any).login(updatedSession, function (error: any) {
                if (error) {
                    next(error);
                    return;
                }
                finishRequest(request, response, 200, JSON.stringify(updatedSession));
            });
        } catch (err) {
            request.logger?.error(err, "password-reset");
            next(err)
        }
    };
}
