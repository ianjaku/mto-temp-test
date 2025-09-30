
export class MSTransactableFailedAccessToken extends Error {
    constructor() {
        super("MS transactable offers: Failed to fetch access token.");
        this.name = "MSTransactableFailedTokenFetch";
    }
}
