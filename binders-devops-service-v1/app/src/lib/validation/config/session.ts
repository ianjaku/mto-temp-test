import { IValidationEnv, strict, typeDomain, typeHost } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const sentinel = t.struct({
    host: typeHost,
    port: t.Number,
}, strict);

const sentinels = t.list(sentinel);

const serverWithSentinels = t.struct({
    useSentinel: t.Boolean,
    host: typeHost,
    port: t.Number,
    sentinels
}, { strict: true } );

const redis = t.struct({
    useSentinel: t.Boolean,
    host: typeHost,
    port: t.Number,
}, { strict: true } );

const getStore = (env: IValidationEnv) => {
    const server = env === "production" ? serverWithSentinels : redis
    return t.struct({
        server,
        type: t.String,
    }, { strict: true } );
}


const environmentCookieDomains = {
    local: t.Nil,
    staging: typeDomain,
    production: typeDomain,
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (env: IValidationEnv) => t.struct({
    secret: t.String,
    maxAge: t.Number,
    store: getStore(env),
    cookieDomain: environmentCookieDomains[env],
}, { strict: true } );