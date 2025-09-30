import * as t from "tcomb";

export default t.struct({
    baseUrl: t.String,
    apiKey: t.String,
}, { strict: true });
