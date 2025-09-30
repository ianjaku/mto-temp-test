import t = require("tcomb");

const ca = t.struct({
    key: t.String,
    cert: t.String,
}, { strict: true } );

const tls = t.struct({
    ca,
}, { strict: true } );

export default t.struct({
    tls,
}, { strict: true } );