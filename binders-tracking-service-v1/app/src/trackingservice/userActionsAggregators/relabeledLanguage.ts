import {
    AggregationResult,
    AggregatorType,
    EventType,
    IItemLanguageRelabeled,
    IUserAction,
    IUserActionDataReadSession,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { assocPath, omit } from "ramda";

/*

This aggregator is binder-based, not publication based.
It doesn't add any new useractions, but updates existing ones (read sessions) via its toComplete array, so they contain the new languageCode

*/

interface ILanguageChangeAction {
    from: string;
    to: string;
}

export default class RelabeledLanguageAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.RELABELLANGUAGE;
    public static eventTypes = [EventType.RELABEL_LANGUAGE];

    aggregate: () => Promise<AggregationResult<IUserActionDataReadSession>> = async () => {
        // get relevant events
        const findEventsInfo = await this.findEventsInRange(
            this.accountId,
            { ...this.eventFilter, eventTypes: RelabeledLanguageAggregator.eventTypes }
        );
        const events = findEventsInfo.events as IItemLanguageRelabeled[];

        const languageChangeActions = events.reduce((reduced, event) => {
            const { data: { itemId, fromLanguageCode, toLanguageCode } } = event;

            const existingAction = reduced[itemId];

            if (existingAction) {
                if (fromLanguageCode === existingAction.to) {
                    reduced[itemId] = { ...existingAction, to: toLanguageCode }
                }
            } else {
                reduced[itemId] = { from: fromLanguageCode, to: toLanguageCode };
            }
            return reduced;
        }, {} as { [itemId: string]: ILanguageChangeAction });

        if (!events || events.length === 0) {
            return {
                aggregatorType: this.aggregatorType,
            }
        }

        // build resource
        const relevantUserActionsResult = await this.trackingService.findUserActions({
            accountId: this.accountId,
            itemIds: events.map(e => e.data.itemId),
            omitDescendantsInItemIds: true,
            userActionTypes: [UserActionType.DOCUMENT_READ],
        });
        const relevantUserActions = relevantUserActionsResult.userActions as Array<IUserAction<IUserActionDataReadSession>>;

        const toComplete = Object.keys(languageChangeActions).reduce((reduced, itemId) => {
            const { from, to } = languageChangeActions[itemId];
            // get relevant old "read session" useractions
            const userActionsToUpdate = relevantUserActions.filter(
                ua => ua.data.itemId === itemId && ua.data.itemLanguage === from
            );

            // update languageCode
            const toCompleteForEvent = userActionsToUpdate.map(userAction =>
                assocPath(["data", "itemLanguage"], to, omit(["sort"], userAction))
            );

            return reduced.concat(toCompleteForEvent);
        }, []);

        return {
            toComplete,
            aggregatorType: this.aggregatorType,
            lastEventTimestamp: findEventsInfo.lastEventTimestamp,
        };
    }
}
