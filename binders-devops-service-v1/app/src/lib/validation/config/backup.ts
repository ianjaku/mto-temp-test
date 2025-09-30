import { IValidationEnv } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const azureRepositoryOptions = t.struct({
    container: t.String,
    compress: t.Boolean,
}, { strict: true } );

const bindersAzure = t.struct({
    repositoryName: t.String,
    repositoryType: t.String,
    repositoryOptions: azureRepositoryOptions,
}, { strict: true } );

const credentials = t.struct({
    login: t.String,
    password: t.maybe(t.String),
}, { strict: true } );

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getBackupStruct = (env: IValidationEnv) => {
    if (env === "production") {
        return t.struct({
            elastic: t.struct({ bindersAzure }),
            mongo: t.struct({ credentials }),
        }, { strict: true } );
    }
    if (env === "staging") {
        return t.struct({
            elastic: t.struct({ bindersAzure }),
            mongo: t.struct({ credentials }),
        }, { strict: true } );
    }
    return t.struct({
        elastic: t.struct({ bindersAzure }),
        mongo: t.Nil,
    }, { strict: true } );
}