import { AggregationResult, AggregatorType, Event, EventType, IUserAction, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { pick } from "ramda";

export default class ItemCreationsAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.ITEMCREATIONS;
    public static eventTypes = [EventType.ITEM_CREATED];

    aggregate: () => Promise<AggregationResult> = async () => {
        const { events, lastEventTimestamp } =
            await this.findEventsInRange(this.accountId, { ...this.eventFilter, eventTypes: ItemCreationsAggregator.eventTypes });
        return {
            toAdd: events.map(this.userActionFromCreatedEvent),
            lastEventTimestamp,
            aggregatorType: this.aggregatorType,
        };
    }

    userActionFromCreatedEvent: (createdEvent: Event) => IUserAction = (createdEvent: Event) => {
        const { timestamp } = createdEvent;
        return {
            ...pick(["userId", "data"], createdEvent),
            accountId: this.accountId,
            userActionType: UserActionType.ITEM_CREATED,
            start: new Date(timestamp),
            end: new Date(timestamp),
            duration: 0
        }
    };
}
