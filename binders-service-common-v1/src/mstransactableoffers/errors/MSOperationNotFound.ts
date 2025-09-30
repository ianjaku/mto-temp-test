
export class MSOperationNotFound extends Error {
    constructor(operationId: string, subscriptionId: string) {
        super(`Operation with id "${operationId}" and subscription id "${subscriptionId}" was not found.`);
        this.name = "MSOperationNotFound";
    }
}
