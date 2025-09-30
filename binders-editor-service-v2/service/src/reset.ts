import * as ejs from "ejs";
import * as express from "express";
import * as fs from "fs";
import { findAccountIdByUserIdAndDomain, getDomainFromRequest, getHostnameForRequest } from "@binders/binders-service-common/lib/util/domains";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { CredentialServiceContract } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TokenVerifier } from "@binders/binders-service-common/lib/tokens";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { findUserByToken } from "@binders/binders-service-common/lib/tokens/helpers";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";
import { isProduction } from "@binders/client/lib/util/environment";

async function renderResetPasswordTemplate(
    _request: WebRequest,
    userId: string,
    login: string,
    displayName: string,
    token: string,
    language: string,
    domain: string,
    isConsumed: boolean,
    isExpired: boolean,
) {
    const resetPasswordTemplateFile = fs.realpathSync("./public/reset.html");
    const resetPasswordFileContents = fs.readFileSync(resetPasswordTemplateFile, "utf8");
    const contents = isProduction() ?
        resetPasswordFileContents :
        fs.readFileSync(resetPasswordTemplateFile, "utf8");
    const templateData = {
        language,
        userData: JSON.stringify({
            userId,
            login,
            displayName,
            token,
            isConsumed,
            isExpired,
        }),
        domain,
    };
    return ejs.render(contents, templateData, {});
}

export function resetPasswordGet(verifier: TokenVerifier, userServiceClient: UserServiceContract, credentialServiceClient: CredentialServiceContract) {
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
                const domain = getHostnameForRequest(request, Application.EDITOR);
                const responseData = await renderResetPasswordTemplate(
                    request,
                    user.id,
                    user.login,
                    user.displayName,
                    token,
                    request.query["l"] as string,
                    domain,
                    tokenIsConsumed,
                    tokenIsExpired,
                );
                response.send(responseData);
            } catch (err) {
                request.logger?.error(`Failed to render reset password template for token: ${token}`, "password-reset");
                next();
                return;
            }
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
            const domain = getDomainFromRequest(request, Application.EDITOR, { returnOnlySubdomain: false });
            const { displayName, newPassword } = request.body;
            const session = await credentialClient.loginWithToken(token);
            const userId = session.userId;
            const user = await userServiceClient.getUser(userId)
            const accountId = await findAccountIdByUserIdAndDomain(userId, domain, routingServiceContract, accountServiceContract);
            const updatedUser = await userServiceClient.updateUser(Object.assign({}, user, { displayName }), accountId);
            const updatedSession = await credentialClient.resetPassword(token, updatedUser.login, newPassword, accountId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (request as any).login(updatedSession, function (error: any) {
                if (error) {
                    request.logger?.error(error, "password-reset");
                    next(error);
                    return;
                }
                finishRequest(request, response, 200, JSON.stringify(updatedSession));
            });
        } catch (err) {
            request.logger?.error(err, "password-reset");
            next(err);
        }
    };
}

export function resendResetPasswordPost(userServiceClient: UserServiceContract) {
    return async function (request: WebRequest, response: express.Response, next: express.NextFunction): Promise<void> {
        try {
            const { login } = request.body;
            await userServiceClient.sendMePasswordResetLink(login, Application.EDITOR);
            finishRequest(request, response, 200, {});
        } catch (err) {
            request.logger?.error(err, "password-reset");
            next(err);
        }
    };
}
