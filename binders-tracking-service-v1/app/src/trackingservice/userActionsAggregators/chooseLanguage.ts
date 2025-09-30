import { AggregationResult, AggregatorType, ChooseLanguageData, Event, EventType, IUserAction, UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { pick } from "ramda";

export default class ChooseLanguageAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.CHOOSELANGUAGE;
    public static eventTypes = [EventType.CHOOSE_LANGUAGE];

    aggregate: () => Promise<AggregationResult> = async () => {
        const { events, lastEventTimestamp } =
            await this.findEventsInRange(this.accountId, { ...this.eventFilter, eventTypes: ChooseLanguageAggregator.eventTypes });
        return {
            toAdd: events.map(this.userActionFromEvent),
            lastEventTimestamp,
            aggregatorType: this.aggregatorType,
        };
    }

    userActionFromEvent: (event: Event) => IUserAction = (event: Event) => {
        const { timestamp } = event;
        return {
            data: <ChooseLanguageData>{
                ...pick(["binderId", "language", "isMachineTranslation"], event.data),
                ...(event.data["document"] ? { publicationId: event.data["document"] } : {}),
            },
            accountId: this.accountId,
            userActionType: UserActionType.CHOOSE_LANGUAGE,
            start: new Date(timestamp),
            end: new Date(timestamp),
        }
    };
}
