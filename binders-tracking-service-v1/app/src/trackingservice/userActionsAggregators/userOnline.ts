import {
    AggregationResult,
    AggregatorType,
    EventType,
    IUserActionFilter,
    IUserActionMap,
    IUserIsOnlineEvent,
    IUserOnlineData,
    IUserOnlineUserAction,
    UserActionType,
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { addHours, isBefore, startOfDay } from "date-fns";
import { IUserActionsRepository } from "../repositories/userActionsRepository";
import { fmtDate } from "@binders/client/lib/util/date";

const USER_ONLINE_INTERVAL_IN_HOURS = 24;

function getKeyInfo(event: IUserIsOnlineEvent) {
    const { accountId, timestampLogged } = event;
    const eventDate = new Date(timestampLogged);
    // since USER_ONLINE_INTERVAL_IN_HOURS is 24h now, we can simplify to start of day
    const intervalStart = startOfDay(eventDate);
    const timestampKey = fmtDate(eventDate, "yyyy-MM-dd-HH");
    const eventKey = `${accountId}-${timestampKey}`;
    return {
        eventKey,
        intervalStart
    };
}

async function prefetch(accountId: string, start: Date, store: IUserActionsRepository) {
    const filter: IUserActionFilter = {
        accountId,
        userActionTypes: [UserActionType.USER_ONLINE],
        startRange: {
            rangeStart: start
        }
    };
    return store.find(filter);
}

function userActionFromEvent(eventKey: string, event: IUserIsOnlineEvent, intervalStart: Date): IUserOnlineUserAction {
    const { accountId, userId } = event;
    return {
        accountId,
        userActionType: UserActionType.USER_ONLINE,
        start: intervalStart,
        end: addHours(intervalStart, USER_ONLINE_INTERVAL_IN_HOURS),
        data: {
            key: eventKey,
            numberOfUsers: 1,
            users: [userId]
        }
    } as IUserOnlineUserAction;
}

function addToResult(
    eventKey: string,
    event: IUserIsOnlineEvent,
    intervalStart: Date,
    processed: { [key: string]: IUserOnlineUserAction },
    processedUsers: { [key: string]: Set<string> },
    userActionsInStore: IUserOnlineUserAction[],
    result: IUserActionMap<IUserOnlineData>,
) {

    const { userId } = event;
    if (eventKey in processed) {
        if (processedUsers[eventKey].has(userId)) {
            return;
        }
        processed[eventKey].data.numberOfUsers++;
        processed[eventKey].data.users.push(userId);
        processedUsers[eventKey].add(userId);
        return;
    }
    const inStore = userActionsInStore.find(ua => ua.data.key === eventKey);
    if (inStore) {
        delete inStore["sort"];
        processed[eventKey] = inStore;
        processedUsers[eventKey] = new Set(inStore.data.users);
        if (processedUsers[eventKey].has(userId)) {
            return;
        }
        inStore.data.numberOfUsers++;
        inStore.data.users.push(userId);
        processedUsers[eventKey].add(userId);
        if (!result.toComplete.find(ua => ua.data.key === eventKey)) {
            result.toComplete.push(inStore);
        }
        return;
    }

    const newUa = userActionFromEvent(eventKey, event, intervalStart);
    result.toAdd.push(newUa);
    processed[eventKey] = newUa;
    processedUsers[eventKey] = new Set([userId]);
}

export default class UserOnlineAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.USERONLINE;
    public static eventTypes = [EventType.USER_IS_ONLINE];

    aggregate: () => Promise<AggregationResult> = async () => {
        const result = {
            toAdd: [],
            toComplete: [],
        };
        let userActionsInStore = [];
        let anHourFromNow = addHours(new Date(), 1);
        const processed = {};
        const processedUsers = {};
        const findEventsInfo = await this.findEventsInRange(
            this.accountId,
            {
                ...this.eventFilter,
                eventTypes: UserOnlineAggregator.eventTypes,
            }
        );
        const events = findEventsInfo.events as IUserIsOnlineEvent[];

        for (const event of events) {
            const { eventKey, intervalStart } = getKeyInfo(event);
            if (isBefore(intervalStart, anHourFromNow)) {
                userActionsInStore = await prefetch(this.accountId, intervalStart, this.userActionsRepository,);
                anHourFromNow = intervalStart;
            }
            addToResult(eventKey, event, intervalStart, processed, processedUsers, userActionsInStore, result)
        }
        return {
            ...result,
            lastEventTimestamp: findEventsInfo.lastEventTimestamp,
            aggregatorType: this.aggregatorType,
        };
    }
}
