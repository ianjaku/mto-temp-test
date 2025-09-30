import * as JWT from "jsonwebtoken";
import { Config } from "@binders/client/lib/config/config";
import { LOG_TOKEN_EXPIRATION_DAYS } from "@binders/client/lib/react/event/EventQueueAuthStore";

export interface JWTSignConfig {
    secret: string;
    options: JWTSignOptions;
}

export interface JWTVerifyConfig {
    secret: string;
    options: JWTVerifyOptions;
}


export interface JWTSignOptions {
    issuer: string;
    // MT-3388 optional in some cases
    // binders-service-common-v1/src/tokens/index.ts L49
    expiresIn?: string;
    algorithm: string;
}

export interface JWTVerifyOptions {
    issuer?: string;
    algorithms: string[];
}

export function verifyJWT<T>(token: string, config: JWTVerifyConfig): Promise<T> {
    return new Promise<T>( (resolve, reject) => {
        if (!config) {
            return reject(new Error("Missing jwt config"));
        }
        JWT.verify(
            token,
            config.secret,
            config.options as JWT.VerifyOptions & {complete: true},
            (error, decoded) => error ? reject(error) : resolve(decoded as unknown as T)
        );
    });
}

export function signJWT(payload: unknown, config: JWTSignConfig): Promise<string> {
    return new Promise<string>( (resolve, reject) => {
        JWT.sign(
            JSON.parse(JSON.stringify(payload)),
            config.secret,
            config.options as JWT.SignOptions,
            (error, token) => error ? reject(error) : resolve(token)
        );
    });
}

const JWT_ISSUER = "binders";
const JWT_BACKEND_ISSUER = "binders-backend";
const JWT_API_ISSUER = "binders-public-api";
const JWT_TRACKING_ISSUER = "binders-tracking";
const JWT_ALGORITHM = "HS256";

const CLIENT_SECRET_KEY = "session.secret";
const BACKEND_SECRET_KEY = "serviceconfig.jwt.secret";
const API_SECRET_KEY = "serviceconfig.api.secret";


export function buildSignConfig(config: Config): JWTSignConfig {
    return signConfig(config, CLIENT_SECRET_KEY, JWT_ISSUER);
}

export function buildSignConfigFromSecret(secret: string): JWTSignConfig {
    return {
        secret,
        options: {
            issuer: JWT_ISSUER,
            expiresIn: "365d",
            algorithm: JWT_ALGORITHM
        }
    };
}

function signConfig(
    config: Config,
    key: string,
    issuer: string,
    expiresIn = "365d"
): JWTSignConfig {
    return {
        secret: config.getString(key).get(),
        options: {
            issuer,
            expiresIn,
            algorithm: JWT_ALGORITHM
        }
    };
}

export function buildLogTokenSignConfig(config: Config): JWTSignConfig {
    return signConfig(config, CLIENT_SECRET_KEY, JWT_TRACKING_ISSUER, `${LOG_TOKEN_EXPIRATION_DAYS}d`);
}

export function buildLogTokenVerifyConfig(config: Config): JWTVerifyConfig {
    const secret = config.getString(CLIENT_SECRET_KEY).get();
    return {
        secret,
        options: {
            issuer: JWT_TRACKING_ISSUER,
            algorithms: [JWT_ALGORITHM]
        }
    };
}

export function buildAccessTokenSignConfig(config: Config): JWTSignConfig {
    return signConfig(config, CLIENT_SECRET_KEY, JWT_ISSUER, "30m");
}

export function buildBackendSignConfig(config: Config): JWTSignConfig {
    if (config.getString(BACKEND_SECRET_KEY).isNothing()) {
        throw new Error("Invalid config: missing jwt backend config");
    }
    return signConfig(config, BACKEND_SECRET_KEY, JWT_BACKEND_ISSUER);
}

export function buildVerifyConfig(config: Config): JWTVerifyConfig {
    const secret = config.getString(CLIENT_SECRET_KEY).get();
    return buildVerifyConfigFromSecret(secret);
}

export function buildVerifyConfigFromSecret(secret: string): JWTVerifyConfig {
    return {
        secret,
        options: {
            issuer: JWT_ISSUER,
            algorithms: [JWT_ALGORITHM]
        }
    };
}

export function buildVerifyConfigFromSecretWithoutIssuer(secret: string): JWTVerifyConfig {
    return {
        secret,
        options: {
            algorithms: [JWT_ALGORITHM]
        }
    };
}

export function buildBackendJwtConfig(config: Config): JWTVerifyConfig {
    const backendSecretOption = config.getString(BACKEND_SECRET_KEY);
    if (backendSecretOption.isNothing()) {
        throw new Error(`Missing config key: ${BACKEND_SECRET_KEY}`);
    }
    const backendSecret = backendSecretOption.get();
    return {
        secret: backendSecret,
        options: {
            issuer: JWT_BACKEND_ISSUER,
            algorithms: [JWT_ALGORITHM]
        }
    };
}

export function buildApiVerifyConfig(config: Config): JWTVerifyConfig {
    const apiSecretOption = config.getString(API_SECRET_KEY);
    if (apiSecretOption.isNothing()) {
        throw new Error(`Missing config key: ${API_SECRET_KEY}`);
    }
    const apiSecret = apiSecretOption.get();
    const apiJwtConfig: JWTVerifyConfig = {
        secret: apiSecret,
        options: {
            issuer: JWT_API_ISSUER,
            algorithms: [JWT_ALGORITHM]
        }
    };
    return apiJwtConfig;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function hookInJWTConfig(config: Config) {
    const jwtConfig = buildVerifyConfig(config);
    const backendJwtConfig = buildBackendJwtConfig(config);
    return (req, res, next) => {
        req.jwtConfig = jwtConfig;
        req.backendJwtConfig = backendJwtConfig;
        next();
    };
}


export const TokenExpiredError = JWT.TokenExpiredError;