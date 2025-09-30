/* eslint-disable no-console */
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AkitaEventType } from "..";
import {
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventPartial } from "../akita";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";


export const getItemsEditedEvents = async (
    account: Account,
    date: string // format yyyy-mm-dd
): Promise<EventPartial[]> => {
    const config = BindersConfig.get();

    const trackingService = await BackendTrackingServiceClient.fromConfig(config, "Akita");
    const itemEditedActions = await trackingService.findUserActions({
        userActionTypes: [UserActionType.ITEM_EDITED],
        accountId: account.id,
        startRange: {
            rangeStart: new Date(`${date}T00:00:00.000Z`),
            rangeEnd: new Date(`${date}T23:59:59.999Z`)
        }
    });

    console.log(`         Found ${itemEditedActions.userActions.length} ITEM_EDITED user actions on ${date}`)

    const eventMap = itemEditedActions.userActions.reduce((acc, action) => {
        const manualtoUserId = action.userId || "public";
        const event = action.data?.itemKind === "collection" ? AkitaEventType.CollectionEdited : AkitaEventType.DocumentEdited;
        const key = `${manualtoUserId}-${event}`;
        if (!acc[key]) {
            acc[key] = {
                manualtoUserId,
                event,
                event_date: date,
                event_count: 0
            }
        }
        acc[key].event_count++;
        return acc;
    }, {} as { [key: string]: EventPartial });

    return Object.values(eventMap);
}