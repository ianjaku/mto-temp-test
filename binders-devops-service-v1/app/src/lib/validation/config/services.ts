import { typeHost, typePath, typeStrictStruct, typeURL } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const services = [
    "account",
    "authorization",
    "credential",
    "comment",
    "content",
    "editor",
    "export",
    "image",
    "manage",
    "notification",
    "binders",
    "partners",
    "routing",
    "static-pages",
    "tracking",
    "user",
    "manualto",
    "dashboard",
    "devops",
    "public-api",
    "screenshot"
]

const service = t.struct({
    prefix: typePath,
    location: typeHost,
    externalLocation: typeURL,
}, { strict: true });

export default typeStrictStruct(services, service);
