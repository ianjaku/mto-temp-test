import {
    AuthenticatedSession,
    IdentityProviderKind,
    Unauthorized
} from "@binders/client/lib/clients/model";
import { JWTVerifyConfig, buildBackendSignConfig, signJWT, verifyJWT } from "../tokens/jwt";
import { RequestHandler, Response } from "express";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendCredentialServiceClient } from "../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { Maybe } from "@binders/client/lib/monad";
import { UserToken } from "../tokens";
import { WebRequest } from "./request";
import { getInflatedUserTokenFromRequest } from "../tokens/helpers";

export interface Authentication {
    (req: WebRequest, options?: IAuthenticationOptions): Promise<Maybe<AuthenticatedSession>>;
}
export interface IAuthenticationOptions {
    tokenConfig?: JWTVerifyConfig;
    extractTokenFromRequest?: boolean;
}

const AUTH_HEADER_REGEX = /(\S+)\s+(\S+)/;

export class BackendSession implements AuthenticatedSession {
    isBackend = true;
    identityProvider: IdentityProviderKind = "backend";
    constructor(readonly userId: string, readonly sessionId: string, readonly accountIds: string[]) {

    }

    static getToken(config: Config, userName: string): Promise<string> {
        const jwtConfig = buildBackendSignConfig(config);
        const toSign = {
            sessionId: `ses-${userName}`,
            userId: `uid-${userName}`,
            accountIds: [],
            isBackend: true
        };
        return signJWT(toSign, jwtConfig);
    }
}

function getDeviceSession(request: WebRequest): AuthenticatedSession | undefined {
    const impersonationStr = request.cookies["impersonation"] as string;
    if (!impersonationStr) {
        return undefined;
    }
    const impersonation = JSON.parse(impersonationStr);
    return impersonation.deviceSession;

}
export function isBackendSession(session: AuthenticatedSession): session is BackendSession {
    return (<BackendSession>session)?.isBackend === true;
}

export const MultiAuthentication: (candidates: Authentication[]) => Authentication = candidates => {
    return async (request: WebRequest) => {
        const errors: Error[] = [];
        for (const candidate of candidates) {
            try {
                return await candidate(request)
            } catch (e) {
                errors.push(e);
            }
        }
        errors.forEach(error => request.logger.error(error.message, "multi-authentication"));
        throw new Unauthorized("All authentication candidates failed");
    };
};

function getBackendJwtConfig(req: WebRequest, options: IAuthenticationOptions) {
    if (options && !options.extractTokenFromRequest) {
        return options.tokenConfig;
    }
    return req.backendJwtConfig
}

export const Public: Authentication = () => Promise.resolve(Maybe.nothing<AuthenticatedSession>());
export const BackendToken: Authentication = (req, backendJwtConfigOptions) => protectWithJWT(req, getBackendJwtConfig(req, backendJwtConfigOptions));
export const ApplicationToken: Authentication = (req) => protectWithJWT(req, req.jwtConfig);
export const ApplicationTokenOrPublic: Authentication = MultiAuthentication([ApplicationToken, Public]);

export function buildUserTokenAuthentication(accountService: AccountServiceContract): (req: WebRequest) => Promise<Maybe<AuthenticatedSession>> {
    return (req: WebRequest) => protectWithUserToken(accountService, req);
}

async function protectWithJWT(req: WebRequest, jwtConfig: JWTVerifyConfig): Promise<Maybe<AuthenticatedSession>> {
    const reject = (reason: string) => {
        throw new Unauthorized("Authorization failure: " + reason);
    };

    const jwtHeader = req.headers["authorization"];
    if (!jwtHeader) {
        return reject("Missing header");
    }
    const headerPartMatches = AUTH_HEADER_REGEX.exec(jwtHeader);
    if (headerPartMatches === null) {
        return reject("Invalid header: " + jwtHeader);
    }
    const scheme = headerPartMatches[1];
    const token = headerPartMatches[2];
    if (scheme !== "JWT") {
        return reject("Invalid authentication scheme: " + scheme);
    }

    try {
        const validSessionStructure = await verifyJWT<AuthenticatedSession>(token, jwtConfig);
        if (req.isSessionValid) {
            try {
                const isValid = await req.isSessionValid();
                if (!isValid) {
                    const sid = validSessionStructure.sessionId;
                    return reject(`Invalid session ${sid}`);
                }
            } catch (err) {
                return reject(err.message || err);
            }

        }
        return Maybe.just(validSessionStructure);
    } catch (error) {
        return reject(error.message);
    }
}

export async function protectWithUserToken(accountService: AccountServiceContract, request: WebRequest): Promise<Maybe<AuthenticatedSession>> {
    let userToken: UserToken;
    try {
        userToken = await getInflatedUserTokenFromRequest(request, accountService);
    } catch (e) {
        throw new Unauthorized(`Authorization failure: ${e}`);
    }
    const { data: { exp } } = userToken;
    if (new Date().getTime() / 1000 > exp) {
        throw new Unauthorized("Authorization failure: Usertoken expired");
    }
    return Maybe.nothing<AuthenticatedSession>();
}

export async function fetchAccessTokenWithSession(
    config: Config,
    session: AuthenticatedSession
): Promise<null | string> {
    if (!session) {
        return null;
    }
    const credentialsClient = await BackendCredentialServiceClient.fromConfig(
        config,
        "common"
    );
    return await credentialsClient.createUserAccessToken(
        session.sessionId,
        session.userId,
        session.accountIds,
        session.isDeviceUser,
        session.deviceUserId
    );
}

export function buildFetchAccessTokenEndpoint(
    config: Config
): RequestHandler {
    return async (request: WebRequest, response): Promise<void> => {
        const session = request.user;
        if (session == null) {
            response.json({ token: null });
            return;
        }
        const token = await fetchAccessTokenWithSession(config, session);
        response.json({ token });
    }
}

export function buildFetchAccessTokensEndpoint(
    config: Config
): (request: WebRequest, response: Response) => void {
    return async (request: WebRequest, response: Response): Promise<void> => {
        const userSession = request.user;
        if (userSession == null) {
            response.json({ tokens: null });
            return;
        }
        const deviceSession = getDeviceSession(request);
        const [user, device] = await Promise.all([
            fetchAccessTokenWithSession(config, userSession),
            fetchAccessTokenWithSession(config, deviceSession),
        ]);
        response.json({
            tokens: {
                user,
                device
            }
        });
    }
}
