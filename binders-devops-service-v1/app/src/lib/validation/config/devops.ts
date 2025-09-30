// eslint-disable-next-line @typescript-eslint/no-var-requires
const t =  require("tcomb");

const user = t.struct({
    login: t.String,
    password: t.String
}, { strict: true });

const bitbucket = t.struct({
    accessToken: t.String,
}, { strict: true });

export default t.struct({
    user,
    bitbucket
}, { strict: true } );