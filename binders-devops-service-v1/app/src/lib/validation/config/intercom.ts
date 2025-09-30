// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export default t.struct({
    appId: t.String,
    secretKey: t.String,
}, { strict: true } );