import {
    AggregationResult, AggregatorType, IDocumentReadSession, IUserAction,
    IUserActionDataReadSession, UserActionType, getAllDocumentEvents,
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IUserActionsAggregator, UserActionsAggregator } from "./base";
import { flatten, pick } from "ramda";
import { subDays } from "date-fns";

const MAX_INT = 2147483647

export default class ReadSessionsAggregator extends UserActionsAggregator implements IUserActionsAggregator {

    public aggregatorType = AggregatorType.READSESSIONS;
    public static eventTypes = getAllDocumentEvents();

    aggregate = async (): Promise<AggregationResult<IUserActionDataReadSession>> => {
        const { range: { rangeStart } } = this.eventFilter;
        const incompleteSessionsConsiderationRange = {
            startRange: {
                rangeStart: subDays(new Date(rangeStart), 1)
            }
        };
        const incompleteReadSessionFindResult = await this.trackingService.findUserActions({
            accountId: this.accountId,
            userActionTypes: [UserActionType.DOCUMENT_READ],
            ...incompleteSessionsConsiderationRange,
            incomplete: true,
        });
        const incompleteReadSessionUserActions = incompleteReadSessionFindResult.userActions;
        const incompleteReadSessions = incompleteReadSessionUserActions.map(this.readSessionFromUserAction);
        const readSessionsMap = await this.trackingService.buildReadSessionsMapWithPublicationIds(
            this.accountId,
            undefined,
            { ...this.eventFilter, accountIds: [this.accountId] },
            incompleteReadSessions,
            { maxResults: this.eventCountLimit },
        );
        const { toAdd: toAddMap, toComplete: toCompleteMap, lastEventTimestamp } = readSessionsMap;
        const toAddArrays = Object.keys(toAddMap).map(publicationId => toAddMap[publicationId]);
        const allToAdd = flatten(toAddArrays).map(this.userActionFromReadSession);
        const toCompleteArrays = Object.keys(toCompleteMap).map(publicationId => toCompleteMap[publicationId]);
        const allToComplete = flatten(toCompleteArrays).map(this.userActionFromReadSession);
        return {
            toAdd: allToAdd,
            toComplete: allToComplete,
            aggregatorType: this.aggregatorType,
            lastEventTimestamp,
        };
    }

    userActionFromReadSession = (readSession: IDocumentReadSession): IUserAction<IUserActionDataReadSession> => {
        const { sessionId: readSessionId, documentId: publicationId, timeInactive,
            incomplete, userActionId, userActionIndex, userIsAuthor, chunkTimingsMap } = readSession;
        const duration = readSession.end && readSession.start && (readSession.end.getTime() - readSession.start.getTime()) / 1000;
        return {
            accountId: this.accountId,
            userActionType: UserActionType.DOCUMENT_READ,
            index: userActionIndex,
            ...pick(["userId", "start", "end"], readSession),
            ...(duration !== undefined ? { duration } : {}),
            id: userActionId,
            data: {
                itemId: readSession.binderId,
                itemKind: "binder",
                itemTitle: readSession.documentName,
                itemLanguage: readSession.language,
                readSessionId,
                publicationId,
                timeInactive: timeInactive < MAX_INT ? timeInactive : MAX_INT,
                ...(incomplete !== undefined ? { incomplete } : {}),
                userIsAuthor,
                path: readSession.path,
                semanticLinkId: readSession.semanticLinkId,
                chunkTimingsMap: JSON.stringify(chunkTimingsMap),
            }
        }
    };

    readSessionFromUserAction = (userAction: IUserAction<IUserActionDataReadSession>): IDocumentReadSession => {
        const { id, userActionType, userId, start, end, index, data: {
            itemId: binderId, publicationId: documentId, readSessionId: sessionId,
            timeInactive, incomplete, itemTitle, itemLanguage, path, semanticLinkId,
            chunkTimingsMap,
        } } = userAction;
        return {
            userActionType,
            userId,
            start: new Date(start),
            end: new Date(end),
            binderId,
            documentId,
            sessionId,
            timeInactive,
            incomplete,
            userActionId: id,
            userActionIndex: index,
            documentName: itemTitle,
            language: itemLanguage,
            path,
            semanticLinkId,
            chunkTimingsMap: JSON.parse(chunkTimingsMap || "{}"),
        } as IDocumentReadSession;
    };
}
