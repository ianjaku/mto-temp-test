import { ObjectConfig } from "@binders/client/lib/config";
import { OneTimeLoginToken } from "../../../src/tokens";
import { addDays } from "date-fns";
import { buildSignConfig } from "../../../src/tokens/jwt";
import { extractJWT } from "../../../src/tokens/helpers";
import { v4 } from "uuid";

const config = new ObjectConfig({
    session: {
        secret: v4()
    }
});

const now = new Date();
const inFuture = addDays(now, 7);
const signConfig = buildSignConfig(config);

function getToken(): Promise<OneTimeLoginToken> {
    return OneTimeLoginToken.build(signConfig, "uid-123", inFuture);
}

describe("valid token", () => {
    it("returns the same string", async () => {
        const token = await getToken();
        expect(extractJWT(token.key)).toEqual(token.key);
    });
});

describe("valid token with query parameters as suffix", () => {
    it("returns the token only", async () => {
        const token = await getToken();
        expect(extractJWT(`${token.key}&source=gmail&ust=123456`)).toEqual(token.key);
    });
});
