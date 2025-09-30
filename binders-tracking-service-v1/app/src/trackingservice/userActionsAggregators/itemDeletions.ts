import { AggregationResult, AggregatorType, Event, EventType, IUserAction, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { pick } from "ramda";


export default class ItemDeletionsAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.ITEMDELETIONS;
    public static eventTypes = [EventType.ITEM_DELETED];

    aggregate: () => Promise<AggregationResult> = async () => {
        const { events, lastEventTimestamp } =
            await this.findEventsInRange(this.accountId, { ...this.eventFilter, eventTypes: ItemDeletionsAggregator.eventTypes });
        return {
            toAdd: events.map(this.userActionFromDeletedEvent),
            aggregatorType: this.aggregatorType,
            lastEventTimestamp,
        };
    }

    userActionFromDeletedEvent: (deletedEvent: Event) => IUserAction = (deletedEvent: Event) => {
        const { timestamp } = deletedEvent;
        return {
            ...pick([ "userId", "data" ], deletedEvent),
            accountId: this.accountId,
            userActionType: UserActionType.ITEM_DELETED,
            start: new Date(timestamp),
            end: new Date(timestamp),
            duration: 0
        }
    };
}
