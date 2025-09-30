/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    IGetSubscriptionResponse,
    IResolvePurchaseIdTokenResponse
} from  "./apiresponses/IResolvePurchaseIdTokenResponse";
import { IMSOPeration } from "./apiresponses/IMSOperation";
import { IMSTransactableOffersApi } from "./IMSTransactableOffersApi";
import { MSTransactableOffersConfig } from "./MSTransactableOffersConfig";
import { NotImplemented } from "./errors/NotImplemented";
import UUID from "@binders/client/lib/util/uuid";

export class MSTransactableOffersApiDummy implements IMSTransactableOffersApi {

    constructor(
        private readonly config: MSTransactableOffersConfig
    ) {}

    async getOperationById(): Promise<IMSOPeration> {
        throw new NotImplemented("getOperationById is not available in the stub");
    }

    public async activateSubscription(
        subscriptionId: string,
        planId: string,
        quantity: number
    ): Promise<void> {
        return;
    }

    async getSubscription(
        subscriptionId: string
    ): Promise<IGetSubscriptionResponse> {
        return this.getDummySubscription();
    }
    
    async resolvePurchaseIdToken(purchaseIdToken: string): Promise<IResolvePurchaseIdTokenResponse> {
        return {
            id:  "43b2e9de-2cef-11ec-8d3d-0242ac130003",
            offerId: "dummy-offer",
            planId: "dummy-plan",
            quantity: 20,
            subscriptionName: "Contoso Cloud Solution",
            subscription: this.getDummySubscription()
        }
    }

    private getDummySubscription() {
        return {
            id: "9ce56dff-808f-452e-810d-dd1f1aa57880",
            name: "Contoso cloud solution",
            saasSubscriptionStatus: "PendingFulfillmentStart",
            offerId: "dummy-offer",
            publisherId: "contoso",
            beneficiary: {
                emailId: "beneficiary@example.com",
                objectId: UUID.random().toString(),
                tenantId: UUID.random().toString(),
                pid: UUID.random().toString()
            },
            purchaser: {
                emailId: "purchaser@example.com",
                objectId: UUID.random().toString(),
                tenantId: UUID.random().toString(),
                pid: UUID.random().toString()
            },
            planId: "dummy-plan",
            term: {
                termUnit: "P1M",
                startDate: "2019-",
                endDate: ""
            },
            isTest: true,
            isFreeTrial: false,
            allowedCustomerOperations: ["Update", "Delete", "Read"],
            sandboxType: "None",
            sessionMode: "None"
        }
    }
}