import {
    JWTSignConfig,
    JWTVerifyConfig,
    TokenExpiredError,
    signJWT,
    verifyJWT
} from "./jwt";
import { TokenData, TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { addDays, isBefore } from "date-fns";
import { omit, splitEvery } from "ramda";
import TokenAcl from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import { Unauthorized } from "@binders/client/lib/clients/model";

interface IUserToken {
    sub: string;
    impersonatedUser: string;
    iat: number;
    exp: number;
}

export class TokenBuilder {
    constructor(private readonly signConfig: JWTSignConfig) {
    }

    private getTokenData<T extends TokenType, S extends TokenData<T>>(type: T, data: S, invalidated: boolean, expirationDate: Date): TokenData<T> {
        if (type === TokenType.USER) {
            return data;
        }
        return {
            type,
            data,
            invalidated,
            expirationDate
        };
    }

    private getSignConfig<T extends TokenType>(type: T): JWTSignConfig {
        if (type === TokenType.USER) {
            return {
                ...this.signConfig,
                options: omit(["expiresIn"], this.signConfig.options),
            };
        }
        return this.signConfig;
    }

    async build<T extends TokenType, S extends TokenData<T>> (type: T, data: S, invalidated: boolean, expirationDate: Date): Promise<Token<TokenType, TokenData<TokenType>>> {
        const tokenData = this.getTokenData<T, S>(type, data, invalidated, expirationDate);
        const signConfig = this.getSignConfig(type);
        const signedData = await signJWT(tokenData, signConfig)
        return TokenFactory.getToken(signedData, type, data, invalidated, expirationDate);
    }
}

export class TokenFactory {
    static getToken(signedData: string, type: TokenType, data: TokenData<TokenType>, invalidated: boolean, expirationDate: Date): Token<TokenType, TokenData<TokenType>> {
        switch (type) {
            case TokenType.ONE_TIME_LOGIN:
                return new OneTimeLoginToken(signedData, type, <OneTimeLoginData>data, invalidated, expirationDate);
            case TokenType.URL:
                return new UrlToken(signedData, type, <UrlTokenData>data, invalidated, expirationDate);
            case TokenType.USER:
                return new UserToken(signedData, type, <UserTokenData>data, invalidated, expirationDate);
        }
        throw new Error(`Unknown token type: ${type}`);
    }
}

export abstract class Token<T extends TokenType, S extends TokenData<T>> {
    constructor(readonly key: string,
        readonly type: T,
        readonly data: S,
        readonly invalidated: boolean,
        readonly expirationDate: Date) {
    }

    isExpired(): boolean {
        return isBefore(this.expirationDate, Date.now());
    }

    isValid(): boolean {
        if (this.invalidated) {
            return false;
        }
        if (this.isExpired()) {
            return false;
        }
        return this.isDataValid();
    }

    invalidate(): Token<T, S> {
        return Object.assign(Object.create(this.constructor.prototype), this, { invalidated: true });
    }

    protected abstract isDataValid(): boolean;
}

export type GenericToken = Token<TokenType, TokenData<TokenType>>;

export class TokenVerifier {
    constructor(private readonly verifyConfig: JWTVerifyConfig) {
    }

    async inflate(token: string): Promise<GenericToken> {
        const decoded = await verifyJWT<GenericToken>(token, this.verifyConfig);
        return TokenFactory.getToken(token, decoded.type, decoded.data, decoded.invalidated, new Date(decoded.expirationDate));
    }

    async inflateUserToken(token: string): Promise<GenericToken> {
        const decoded = await verifyJWT<IUserToken>(token, this.verifyConfig);
        if (decoded?.exp == null || typeof decoded.exp !== "number" || isNaN(decoded.exp)) {
            throw new Unauthorized("Invalid user token", "Invalid user token");
        }
        return TokenFactory.getToken(token, TokenType.USER, decoded, false, new Date(decoded.exp * 1000));
    }

    async verify(token: string): Promise<boolean> {
        try {
            const inflatedToken = await this.inflate(token);
            return inflatedToken.isValid();
        } catch (error) {
            if (error.name === "JsonWebTokenError") {
                return false;
            }
            throw error;
        }
    }
}

export const JWTTokenExpiredError = TokenExpiredError;

export interface OneTimeLoginData extends TokenData<TokenType.ONE_TIME_LOGIN> {
    userId: string;
    consumed?: Date;
}

export class OneTimeLoginToken extends Token<TokenType.ONE_TIME_LOGIN, OneTimeLoginData> {
    isDataValid(): boolean {
        return this.data.consumed === undefined;
    }

    consume(): OneTimeLoginToken {
        const updatedData = Object.assign(this.data, { consumed: new Date() });
        return new OneTimeLoginToken(this.key, this.type, updatedData, this.invalidated, this.expirationDate);
    }

    static build(signConfig: JWTSignConfig, userId: string, expirationDate: Date): Promise<OneTimeLoginToken> {
        const builder = new TokenBuilder(signConfig);
        return builder.build(TokenType.ONE_TIME_LOGIN, {userId}, false, expirationDate) as Promise<OneTimeLoginToken>;
    }
}

export interface UserTokenData extends TokenData<TokenType.USER> {
    sub: string;
    impersonatedUser: string;
    exp: number;
    iat: number;
    consumed?: Date;
}

export class UserToken extends Token<TokenType.USER, UserTokenData> {
    isDataValid(): boolean {
        return this.data.consumed === undefined;
    }

    consume(): UserToken {
        const updatedData = Object.assign(this.data, { consumed: new Date() });
        return new UserToken(this.key, this.type, updatedData, this.invalidated, this.expirationDate);
    }

    static build(
        signConfig: JWTSignConfig,
        userId: string,
        impersonatedUser: string,
        issuedAt: Date,
        expiresAt: Date,
    ): Promise<UserToken> {
        const builder = new TokenBuilder(signConfig);
        return builder.build(TokenType.USER, {
            sub: userId,
            exp: expiresAt.getTime() / 1000,
            iat: issuedAt.getTime() / 1000,
            impersonatedUser
        }, false, expiresAt) as Promise<UserToken>;
    }
}

export interface UrlTokenData extends TokenData<TokenType.URL> {
    acl: TokenAcl;
}

export class UrlToken extends Token<TokenType.URL, UrlTokenData> {
    isDataValid(): boolean {
        return true;
    }

    consume(): UrlToken {
        const updatedData = Object.assign(this.data, { consumed: new Date() });
        return new UrlToken(this.key, this.type, updatedData, this.invalidated, this.expirationDate);
    }

    static build(signConfig: JWTSignConfig, acl: TokenAcl, expirationDate: Date): Promise<UrlToken> {
        const builder = new TokenBuilder(signConfig);
        return builder.build(TokenType.URL, { acl }, false, expirationDate) as Promise<UrlToken>;
    }

    static async buildMany(documentIds: string[], signConfig: JWTSignConfig, numberOfDays: number): Promise<{[id: string]: UrlToken}> {
        const chunks = splitEvery(10, documentIds);
        const builder = new TokenBuilder(signConfig);
        const result: {[id: string]: UrlToken} = {};
        const expirationDate = addDays(Date.now(), numberOfDays);
        for (const chunk of chunks) {
            const acl = TokenAcl.fromItemIds(chunk);
            const token = (await builder.build(TokenType.URL, { acl }, false, expirationDate)) as UrlToken;
            for (const documentId of chunk) {
                result[documentId] = token;
            }
        }
        return result;
    }
}
