
export interface IGetSubscriptionResponse {
    id: string,
    publisherId: string,
    offerId: string,
    name: string,
    saasSubscriptionStatus: string,
    beneficiary: {
        emailId: string,
        objectId: string,
        tenantId: string,
        pid: string
    },
    purchaser: {
        emailId: string,
        objectId: string,
        tenantId: string,
        pid: string 
    },
    planId: string,
    term: {
        termUnit: string, // "PM1"
        startDate: string, // format "yyyy-LL-dd"
        endDate: string // format "yyyy-LL-dd"
    },
    isTest: boolean,
    isFreeTrial: boolean,
    allowedCustomerOperations: string[], // ["Delete", "Update", "Read"]
    sandboxType: string, // "None"
    sessionMode: string // "None"
}

export interface IResolvePurchaseIdTokenResponse {
    id: string, // purchased SaaS subscription ID
    subscriptionName: string, // SaaS subscription name
    offerId: string, // purchased offer ID
    planId: string, // purchased offer's plan ID
    quantity: number, // number of purchased seats, might be empty if the plan is not per seat
    subscription: IGetSubscriptionResponse // full SaaS subscription details, see Get Subscription APIs response body for full description
}

