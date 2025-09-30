import {
    IGetSubscriptionResponse,
    IResolvePurchaseIdTokenResponse
} from  "./apiresponses/IResolvePurchaseIdTokenResponse";
import { IMSOPeration } from "./apiresponses/IMSOperation";

export interface IMSTransactableOffersApi {
    getSubscription(
        subscriptionId: string
    ): Promise<IGetSubscriptionResponse>;
    
    activateSubscription(
        subscriptionId: string,
        planId: string,
        quantity: number
    ): Promise<void>;
    
    resolvePurchaseIdToken(
        purchaseIdToken: string
    ): Promise<IResolvePurchaseIdTokenResponse>;

    getOperationById(
        operationId: string,
        subscriptionId: string
    ): Promise<IMSOPeration>;
}