import * as t from "tcomb";

export default t.struct({
    publicKey: t.String,
}, { strict: true });
