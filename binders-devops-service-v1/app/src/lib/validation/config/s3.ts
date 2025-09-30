import { IValidationEnv, typeHost } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const envValues = {
    local: t.String,
    staging: typeHost,
    production: typeHost,
};

const getS3Struct = (env: IValidationEnv) => t.struct({
    accessKey: t.String,
    bucket: envValues[env],
    region: envValues[env],
    transcoderRegion: envValues[env],
    secret: t.String,
    maxRetries: t.Number,
}, { strict: true });

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (env: IValidationEnv) => t.struct({
    videos: getS3Struct(env)
}, { strict: false });