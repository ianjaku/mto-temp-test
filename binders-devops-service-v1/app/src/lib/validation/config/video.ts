import { typeStrictStruct } from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const presetIds = [
    "1487064576053-mdl3ca",
    "1487175780278-v23uba",
    "1513767687431-7t9hr6",
    "1513775848126-cgde7j",
    "1513775920124-m8lqoe",
    "1513775971818-svrs1n",
    "1513776022903-li793a",
]

const transcoding = t.struct({
    pipelineId: t.String,
    presetIds: typeStrictStruct(presetIds, t.String),
}, { strict: true } );

export default t.struct({ transcoding }, { strict: true });