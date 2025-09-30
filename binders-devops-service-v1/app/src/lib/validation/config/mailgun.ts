import { typeDomain } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export default t.struct({
    apiKey: t.String,
    domain: typeDomain,
}, { strict: true } );