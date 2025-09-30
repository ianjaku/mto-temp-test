import * as t from "tcomb";

export default t.struct({
    apiKey: t.String,
    analyticsKey: t.maybe(t.String),
}, { strict: true } );