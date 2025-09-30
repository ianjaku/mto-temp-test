import { AggregatorType, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Event } from "../models/event";

export function dedupeEvents(events: Event[]): Event[] {
    return events.reduce((reduced, event) => {
        const { eventType, timestamp, userId } = event;
        if (!reduced.some(evt => evt.eventType === eventType && evt.timestamp === timestamp && evt.userId === userId)) {
            reduced.push(event);
        }
        return reduced;
    }, [] as Event[]);
}

export function __TEMPaggregatorTypeFromUserActionType(userActionType: UserActionType): AggregatorType {
    switch (userActionType) {
        case UserActionType.DOCUMENT_READ:
            return AggregatorType.READSESSIONS;
        case UserActionType.CHOOSE_LANGUAGE:
            return AggregatorType.CHOOSELANGUAGE;
        case UserActionType.ITEM_CREATED:
            return AggregatorType.ITEMCREATIONS;
        case UserActionType.ITEM_DELETED:
            return AggregatorType.ITEMDELETIONS;
        case UserActionType.ITEM_EDITED:
            return AggregatorType.ITEMEDITED;
        case UserActionType.ITEM_HARD_DELETED:
            return AggregatorType.ITEMHARDDELETIONS;
        case UserActionType.USER_ONLINE:
            return AggregatorType.USERONLINE;
        case UserActionType.LANGUAGE_ADDED:
            return AggregatorType.CHOOSELANGUAGE;
        default:
            throw new Error(`Unexpected user action type: ${userActionType}`);
    }
}