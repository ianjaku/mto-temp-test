
export class CombinedError extends Error {
    constructor(
        public readonly errors: Error[]
    ) {
        super("Combined errors: " + errors.map(e => e?.message).join(" - "));
    }
}
