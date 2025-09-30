import * as t from "tcomb";

const mtEngine = t.struct({
    host: t.String,
    subscriptionKey: t.String,
}, { strict: true } );

export default t.struct(
    {
        azure: mtEngine,
        google: mtEngine,
        deepl: mtEngine,
    },
    { strict: true }
);