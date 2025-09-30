import { typeLogLevel } from "../types";

import t = require("tcomb");

export default t.struct({
    default: t.struct({
        level: typeLogLevel,
    }),
}, { strict: true } );