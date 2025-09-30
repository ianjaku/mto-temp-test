import { MSAccountSetupRequest, MSTransactableEventCommon, MSTransactableEventInit } from "../model";
import { IMSOPeration } from "@binders/binders-service-common/lib/mstransactableoffers/apiresponses/IMSOperation";

export function transactableEventFromOperation(operation: IMSOPeration): MSTransactableEventCommon {
    return new MSTransactableEventCommon(
        operation.action,
        operation.id,
        operation.activityId,
        operation.subscriptionId,
        operation.offerId,
        operation.publisherId,
        operation.planId,
        operation.quantity,
        operation.timeStamp,
        operation.status
    );
}

export function transactableEventFromSetupRequest(
    setupRequest: MSAccountSetupRequest
): MSTransactableEventInit
{
    return new MSTransactableEventInit(
        setupRequest.purchaseIdToken,
        setupRequest.transactableId,
        setupRequest.subscriptionId,
        setupRequest.offerId,
        setupRequest.planId,
        setupRequest.tenantId,
        setupRequest.quantity,
        setupRequest.firstName,
        setupRequest.lastName,
        setupRequest.phone,
        setupRequest.companyName,
        setupRequest.companySite,
        setupRequest.email
    );
}