import { OneTimeLoginData, OneTimeLoginToken } from "../../../src/tokens";
import { addDays, subDays } from "date-fns";
import { ObjectConfig } from "@binders/client/lib/config";
import { TokenBuilder } from "../../../src/tokens";
import { TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { buildSignConfig } from "../../../src/tokens/jwt";
import { v4 } from "uuid";

const config = new ObjectConfig({
    session: {
        secret: v4()
    }
});

const now = new Date();
const withinAWeek = addDays(now, 7);
const aWeekAgo = subDays(now, 7);
const signConfig = buildSignConfig(config);
const builder = new TokenBuilder(signConfig);

function getToken(expirationDate: Date): Promise<OneTimeLoginToken> {
    const data: OneTimeLoginData = {
        userId: "uid-123"
    };
    return builder.build(TokenType.ONE_TIME_LOGIN, data, false, expirationDate) as Promise<OneTimeLoginToken>;
}

function isValid(expirationDate: Date): Promise<boolean> {
    return getToken(expirationDate).then(token => token.isValid());
}

describe("one time login token", () => {
    it("should be valid after creation", () => {
        return isValid(withinAWeek).then(isValid => expect(isValid).toBe(true));
    });

    it("should be invalid after expiration", () => {
        return isValid(aWeekAgo).then(isValid => expect(isValid).toBe(false));
    });
    it("should be invalid after invalidation", () => {
        return getToken(withinAWeek)
            .then(token => {
                const invalidatedToken = token.invalidate();
                expect(invalidatedToken.key).toEqual(token.key);
                return invalidatedToken.isValid();
            })
            .then(isValid => expect(isValid).toBe(false));
    });
    it("should be invalid after consumption", () => {
        return getToken(withinAWeek)
            .then(token => {
                const consumedToken = token.consume();
                expect(consumedToken.key).toEqual(token.key);
                return consumedToken.isValid();
            })
            .then(isValid => expect(isValid).toBe(false));
    });
});
