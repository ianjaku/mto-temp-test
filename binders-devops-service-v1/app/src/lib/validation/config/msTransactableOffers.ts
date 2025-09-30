import * as t from "tcomb";
import { IValidationEnv, strict } from "../types";

const baseValidation = {
    azureSSOAppID: t.String,
    azureSSORedirectURI: t.String,
    azureSSOAuthority: t.String
}

export default (env: IValidationEnv): t.Struct<unknown> => {
    if(env === "local") {
        return t.struct({
            useStub: t.Boolean,
            ...baseValidation
        }, strict);
    }
    return t.struct({
        appId: t.String,
        appSecret: t.String,
        tenantId: t.String,
        notificationEmailAddress: t.String,
        ...baseValidation
    })
}
