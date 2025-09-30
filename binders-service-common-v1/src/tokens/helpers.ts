import { CredentialServiceContract, GenericToken, TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { OneTimeLoginToken, TokenVerifier, UserToken } from ".";
import { User, UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Logger } from "../util/logging";
import { WebRequest } from "../middleware/request";
import { buildVerifyConfigFromSecretWithoutIssuer } from "./jwt";
import { timingSafeEqual } from "crypto";

const USERTOKEN_QUERYPARAM = "ut";

export async function getInflatedUserTokenFromRequest(
    request: WebRequest,
    accountService: AccountServiceContract,
): Promise<UserToken> {
    const userToken = request.query[USERTOKEN_QUERYPARAM] as string;
    if (!userToken) {
        throw "Missing usertoken (ut) in url";
    }
    const accountSettings = await accountService.getAccountSettings(request.query["accountId"] as string);
    const verifyConfig = buildVerifyConfigFromSecretWithoutIssuer(accountSettings.userTokenSecret);
    const tokenVerifier = new TokenVerifier(verifyConfig);
    try {
        return await tokenVerifier.inflate(userToken) as UserToken;
    } catch (e) {
        throw `Usertoken authentication failed: ${e}`;
    }
}

const JWT_PATTERN = /^([\w-]+\.[\w-]+\.[\w-]+).*$/;

export function extractJWT(stringWithToken: string): string | null {
    const matches = stringWithToken.match(JWT_PATTERN);
    if (matches) {
        return matches.length === 2 ? matches[1] : stringWithToken;
    }
    return null;
}

type UserFromToken =
    { type: "success", user: User, token: string, tokenIsConsumed: boolean, tokenIsExpired: boolean } |
    { type: "error", msg: string };

export async function findUserByToken(
    receivedToken: string,
    verifier: TokenVerifier,
    userServiceClient: UserServiceContract,
    credentialServiceClient: CredentialServiceContract,
    logger: Logger,
): Promise<UserFromToken> {
    const token = extractJWT(receivedToken);
    if (!token || !token.length) {
        return { type: "error", msg: `Received token does not look like JWT token ${receivedToken}` };
    }

    if (!timingSafeEqual(Buffer.from(token), Buffer.from(receivedToken))) {
        logger.info(`Received token ${receivedToken} does not look like JWT token, but token-like string was extracted ${token}`, "reset-password");
    }

    let inflatedDBToken: GenericToken;
    try {
        inflatedDBToken = await credentialServiceClient.getToken(token);
    }
    catch (err) {
        return { type: "error", msg: `Non-existing token received ${token}` };
    }

    let inflatedToken: GenericToken;
    try {
        inflatedToken = await verifier.inflate(token);
    }
    catch (err) {
        logger.error(err, "reset-password");
        return { type: "error", msg: `Invalid token received ${token}` };
    }

    if (inflatedToken.type !== TokenType.ONE_TIME_LOGIN) {
        return { type: "error", msg: `Expected token of type ONE_TIME_LOGIN, but received type ${TokenType[inflatedToken.type]}, token: ${token}` };
    }

    const userId = (<OneTimeLoginToken>inflatedToken).data.userId;
    let user: User;
    try {
        user = await userServiceClient.getUser(userId);
    } catch (err) {
        return { type: "error", msg: `User ${userId} not found, token: ${token}` };
    }

    return {
        type: "success",
        user,
        token,
        tokenIsConsumed: !!((<OneTimeLoginToken>inflatedDBToken).data.consumed),
        tokenIsExpired: (<OneTimeLoginToken>inflatedToken).isExpired(),
    };
}

