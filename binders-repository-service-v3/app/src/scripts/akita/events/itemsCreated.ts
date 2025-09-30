/* eslint-disable no-console */
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AkitaEventType } from "..";
import {
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventPartial } from "../akita";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";

export const getItemsCreatedEvents = async (
    account: Account,
    date: string
): Promise<EventPartial[]> => {
    const config = BindersConfig.get();

    const trackingService = await BackendTrackingServiceClient.fromConfig(config, "Akita");
    const itemCreatedActions = await trackingService.findUserActions({
        userActionTypes: [UserActionType.ITEM_CREATED],
        accountId: account.id,
        startRange: {
            rangeStart: new Date(`${date}T00:00:00.000Z`),
            rangeEnd: new Date(`${date}T23:59:59.999Z`)
        }
    });

    console.log(`         Found ${itemCreatedActions.userActions.length} ITEM_CREATED user actions on ${date}`)

    const eventMap = itemCreatedActions.userActions.reduce((acc, action) => {
        const manualtoUserId = action.userId || "public";
        const event = action.data?.itemKind === "collection" ? AkitaEventType.CollectionCreated : AkitaEventType.DocumentCreated;
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
