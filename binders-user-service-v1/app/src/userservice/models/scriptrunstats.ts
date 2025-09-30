
export class ScriptRunStat {
    constructor(
        public scriptName: string,
        public runDateTime: Date,
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
        public data: any,
    ) {
    }
}