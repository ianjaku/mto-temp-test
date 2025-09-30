// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export default t.struct({
    webhooks: t.struct({
        techtalk: t.String
    }, { strict: true }),
}, { strict: true } );