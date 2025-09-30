/* eslint-disable no-console */
import {
    IUserActionDataReadSession,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AkitaEventType } from "..";
import {
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventPartial } from "../akita";

export const getReadEvents = async (
    account: Account,
    date: string // format "yyyy-MM-dd"
): Promise<EventPartial[]> => {
    const config = BindersConfig.get();
    const trackingService = await BackendTrackingServiceClient.fromConfig(config, "Akita");

    const readActions = await trackingService.findUserActions({
        userActionTypes: [UserActionType.DOCUMENT_READ],
        accountId: account.id,
        startRange: {
            rangeStart: new Date(`${date}T00:00:00.000Z`),
            rangeEnd: new Date(`${date}T23:59:59.999Z`)
        }
    });

    console.log(`         Found ${readActions.userActions.length} DOCUMENT_READ user actions on ${date}`);

    const eventMap = readActions.userActions.reduce((acc, action) => {
        const data = action.data as IUserActionDataReadSession;
        const manualtoUserId = action.userId || "public";

        const events = data.userIsAuthor ?
            [AkitaEventType.DocumentRead] :
            [AkitaEventType.DocumentRead, AkitaEventType.DocumentReadNoAuthor]; // if read session wasn't by the author, additionally log DocumentReadNoAuthor event

        for (const event of events) {
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
        }
        return acc;
    }, {} as { [key: string]: EventPartial });

    return Object.values(eventMap);
}
