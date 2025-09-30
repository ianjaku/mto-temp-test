import { IValidationEnv } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const imageServiceDev = t.struct({
    host: t.String,
    port: t.Number,
}, { strict: true } );

const imageService = t.struct({
    host: t.String,
    port: t.Number,
    login: t.String,
    password: t.String,
}, { strict: true } );

const environmentImageServices = {
    local: imageServiceDev,
    production: imageService,
    staging: imageServiceDev,
}

const rabbit = (env: IValidationEnv) => t.struct({ 
    imageService: environmentImageServices[env],
});

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (env: IValidationEnv) => t.maybe(rabbit(env));