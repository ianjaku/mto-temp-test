import { OneTimeLoginData, OneTimeLoginToken } from "../../../src/tokens";
import { TokenBuilder, TokenVerifier } from "../../../src/tokens";
import { buildSignConfig, buildVerifyConfig } from "../../../src/tokens/jwt";
import { ObjectConfig } from "@binders/client/lib/config";
import { TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { addDays } from "date-fns";
import { v4 } from "uuid";

const config = new ObjectConfig({
    session: {
        secret: v4()
    }
});


const now = new Date();
const withinAWeek = addDays(now, 7);

const signConfig = buildSignConfig(config);
const verifyConfig = buildVerifyConfig(config);
const verifier = new TokenVerifier(verifyConfig);

function getBuilder() {
    return new TokenBuilder(signConfig);
}

function getToken(expirationDate: Date): Promise<OneTimeLoginToken> {
    const builder = getBuilder();
    const data: OneTimeLoginData = {
        userId: "uid-123"
    };
    return builder.build(TokenType.ONE_TIME_LOGIN, data, false, expirationDate) as Promise<OneTimeLoginToken>;
}

describe("token verifier", () => {
    it("should be valid after creation", () => {
        return getToken(withinAWeek)
            .then(token => verifier.verify(token.key))
            .then(isValid => expect(isValid).toBe(true));
    });
    it("should invalidate junk", () => {
        return verifier.verify("junk").then(isValid => expect(isValid).toBe(false));
    });
    it("should inflate a token correctly", () => {
        return getToken(withinAWeek).then(token => {
            return verifier.inflate(token.key).then(inflatedToken => expect(inflatedToken).toEqual(token));
        });
    });
});
