import { AggregationResult, AggregatorType, Event, EventType, IUserAction, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { pick } from "ramda";


export default class ItemHardDeletionsAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.ITEMHARDDELETIONS;
    public static eventTypes = [EventType.ITEM_HARD_DELETED];

    aggregate: () => Promise<AggregationResult> = async () => {
        const { events, lastEventTimestamp } =
            await this.findEventsInRange(this.accountId, { ...this.eventFilter, eventTypes: ItemHardDeletionsAggregator.eventTypes });
        return {
            toAdd: events.map(this.userActionFromDeletedEvent),
            lastEventTimestamp,
            aggregatorType: this.aggregatorType,
        };
    }

    userActionFromDeletedEvent: (deletedEvent: Event) => IUserAction = (deletedEvent: Event) => {
        const { timestamp } = deletedEvent;
        return {
            ...pick(["userId", "data"], deletedEvent),
            accountId: this.accountId,
            userActionType: UserActionType.ITEM_HARD_DELETED,
            start: new Date(timestamp),
            end: new Date(timestamp),
            duration: 0
        }
    };
}
