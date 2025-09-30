/* eslint-disable no-useless-escape */
import * as validator from "validator";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

const isUUID = (value:string): boolean => validator.isUUID(value, 4) || validator.isUUID(value, 5);
const isPath = (value: string): boolean => validator.matches(
    value, 
    /^\/([A-z0-9\-_\+]+\/)*([A-z0-9\-_\+])+$/gm,
);
const isEndpoint = (value: string): boolean => validator.matches(
    value,
    /^\/([A-z0-9\-_\+]+\/)*([A-z0-9])+(\??(\w|\-|\.)+=[^&]+&*)?$/gm,
)
const isURL = (value: string): boolean => validator.isURL(value);
const isVersion = (value: string): boolean => validator.matches(
    value,
    /^[0-9]+((\.?[0-9])+)?$/gm,
);

const isLogLevel = (value: string): boolean => validator.isIn(value, [
    "FATAL",
    "ERROR",
    "WARN",
    "INFO",
    "DEBUG",
    "TRACE",
    "ALL",
    "OFF",
]);

const isHost = (value: string): boolean => validator.isURL(
    value, 
    { require_tld: false, require_valid_protocol: false },
);

export const typeUUID = t.refinement(t.String, isUUID);
export const typeDomain = t.refinement(t.String, validator.isFQDN);
export const typePath = t.refinement(t.String, isPath);
export const typeURL = t.refinement(t.String, isURL);
export const typeEndpoint = t.refinement(t.String, isEndpoint);
export const typeVersion = t.refinement(t.String, isVersion);
export const typeLogLevel = t.refinement(t.String, isLogLevel);
export const typeHost = t.refinement(t.String, isHost);
export const typeProtocol = t.enums.of([ "http", "https", "ftp", "sftp" ]);
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const typeStrictStruct = (values: string[], type: unknown) => {
    const struct = values.reduce((out, value) => ({ ...out, [value]: type }), {});
    return t.struct(struct, strict);
};

export const strict = { strict: true };

export type IValidationEnv = "production" | "staging" | "local";