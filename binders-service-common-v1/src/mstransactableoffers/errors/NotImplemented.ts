
export class NotImplemented extends Error {
    constructor(message?: string) {
        super(message ?? "This method is not implemented.");
    }
}
