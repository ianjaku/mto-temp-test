
// Microsoft transactable offers operation interface
export interface IMSOPeration {
    id: string;
    activityId: string;
    subscriptionId: string;
    offerId: string;
    publisherId: string;
    planId: string;
    quantity: number;
    action: "Reinstate" | "ChangePlan" | "ChangeQuantity" | "Suspend" | "Unsubscribe";
    timeStamp: string;
    status: "InProgress" | "NotStarted" | "Failed" | "Succeeded" | "Conflict";
    errorStatusCode: string;
    errorMessage: string;
}
