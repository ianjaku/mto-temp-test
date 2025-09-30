import {
    AggregationResult,
    AggregatorType,
    Event,
    EventType,
    IUserAction,
    ItemEditedUserActionData,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { omit, pick } from "ramda";
import moment from "moment";

interface CombineSessionsResult {
    userActionsToAdd: IUserAction[];
    userActionsToComplete: IUserAction[];
}

function combineSessions(
    accountId: string,
    events: Event[],
    previousEditActions: IUserAction[],
): CombineSessionsResult {
    const userActionsToAddMap: { [sessionId: string]: IUserAction<ItemEditedUserActionData> } = {};
    const userActionsToComplete: IUserAction[] = [];

    for (const event of events.filter(e => e.data?.sessionId)) {

        const sessionId = <string>event.data.sessionId;

        // if in previously processed events, update end of useraction
        if (userActionsToAddMap[sessionId]) {
            userActionsToAddMap[sessionId].end = new Date(event.timestamp);
            continue;
        }

        // if in useractions from a previous aggregation, update end
        const previousEditAction = previousEditActions.find(a => a.data["sessionId"] === sessionId);
        if (previousEditAction) {
            previousEditAction.data["end"] = new Date(event.timestamp).getTime();
            previousEditAction.end = new Date(event.timestamp);
            userActionsToComplete.push(previousEditAction);
            continue;
        }

        // else just add it
        const startDate = new Date(event.timestamp);
        const userActionToAdd = {
            ...pick(["userId", "data"], event),
            userId: event.userId,
            data: {
                ...event.data,
                start: startDate.getTime(),
                end: startDate.getTime(),
            } as ItemEditedUserActionData,
            accountId,
            userActionType: UserActionType.ITEM_EDITED,
            start: startDate,
            end: startDate,
        };
        userActionsToAddMap[sessionId] = userActionToAdd;
    }
    return {
        userActionsToAdd: Object.values(userActionsToAddMap),
        userActionsToComplete,
    }
}

export default class ItemEditionsAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.ITEMEDITED;
    public static eventTypes = [EventType.BINDER_EDITED];

    aggregate: () => Promise<AggregationResult> = async () => {
        const rangeStart = this.eventFilter.range?.rangeStart;
        const incompleteSessionsConsiderationRange = rangeStart ?
            { startRange: { rangeStart: moment(rangeStart).subtract(1, "day").toDate() } } :
            {};
        const findResult = (await this.trackingService.findUserActions({
            accountId: this.accountId,
            userActionTypes: [UserActionType.ITEM_EDITED],
            ...incompleteSessionsConsiderationRange,
        }));
        const previousEditActions = findResult.userActions.map(ua => omit(["sort"], ua));
        const { events, lastEventTimestamp } =
            await this.findEventsInRange(
                this.accountId,
                {
                    ...this.eventFilter,
                    eventTypes: ItemEditionsAggregator.eventTypes,
                },
            );
        const combineSessionResult = combineSessions(this.accountId, events, previousEditActions);
        return {
            toAdd: combineSessionResult.userActionsToAdd,
            toComplete: combineSessionResult.userActionsToComplete,
            lastEventTimestamp,
            aggregatorType: this.aggregatorType,
        };
    }

}
