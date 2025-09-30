import { tcombValidate } from "../../validation";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const ViewPortDimensionsStruct = t.struct({
    width: t.Number,
    height: t.Number,
});

export const validateViewPortDimensions = (dimensionsCandidate: unknown): string[] => {
    return tcombValidate(dimensionsCandidate, ViewPortDimensionsStruct);
}
