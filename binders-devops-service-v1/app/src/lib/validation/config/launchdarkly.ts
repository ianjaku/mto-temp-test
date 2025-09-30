// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

export default t.struct({
    clientSideId: t.String,
    sdkKey: t.String,
}, { strict: true } );