
export class MSTransactableInvalidToken extends Error {
    constructor() {
        super("MS transactable offers: Invalid token.");
        this.name = "MSTransactableInvalidToken";
    }
}
