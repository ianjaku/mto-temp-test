import * as t from "tcomb";


const configByEnvironment = {
    local: t.Nil,
    production: t.struct({
        apiKey: t.String
    }),
    staging: t.Nil,
};

export const akita = (env: string): t.Struct<unknown> => configByEnvironment[env];
