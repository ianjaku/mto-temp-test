import { Authorization, MultiAuthorization } from "../../../src/middleware/authorization";
import { WebRequest } from "../../../src/middleware/request";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const successAuth: Authorization = (req: WebRequest): Promise<void> => {
    return Promise.resolve(undefined);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const failureAuth: Authorization = (req: WebRequest): Promise<void> => {
    return Promise.reject(undefined);
};

function shouldSucceed(auth: Authorization) {
    return auth(undefined).then(() => expect("1").toEqual("1"), () => expect("success").toEqual("failure"));
}

function shouldFail(auth: Authorization) {
    return auth(undefined).then(() => expect("failure").toEqual("success"), () => expect("1").toEqual("1"));
}

describe("multi authorization", () => {
    it("return succes on [positive]", () => {
        return shouldSucceed(MultiAuthorization([successAuth]));
    });

    it("returns failure on [failure]", () => {
        return shouldFail(MultiAuthorization([failureAuth]));
    });

    it("returns success on [positive, failure]", () => {
        return shouldSucceed(MultiAuthorization([successAuth, failureAuth]));
    });

    it("returns success on [failure, positive]", () => {
        return shouldSucceed(MultiAuthorization([failureAuth, successAuth]));
    });

    it("returns failure on [failure, failure]", () => {
        return shouldFail(MultiAuthorization([failureAuth, failureAuth]));
    });
});
