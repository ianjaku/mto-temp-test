// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export default t.struct({
    apiToken: t.String,
    portalId: t.String,
}, { strict: true } );