/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Event,
    EventType,
} from "@binders/client/lib/clients/trackingservice/v1/contract";

export function buildEventData(
    eventType: EventType,
    binderId: string,
    publicationId: string,
    title: string,
    sessionId: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    if (eventType === EventType.DOCUMENT_OPENED) {
        return {
            binderId,
            documentId: publicationId,
            documentType: "publication",
            sessionId,
            title,
            path: "/",
        };
    }
    if (eventType === EventType.DOCUMENT_CLOSED) {
        return {
            collectionId: `col-parent-of-${binderId}`,
            documentType: "publication",
            documentId: publicationId,
            binderId,
            sessionId,
        };
    }
    if (eventType === EventType.READ_SESSION_BLUR) {
        return {
            documentId: publicationId,
            binderId,
            sessionId,
        }
    }
    if (eventType === EventType.READ_SESSION_FOCUS) {
        return {
            documentId: publicationId,
            binderId,
            sessionId,
        }
    }
    throw new Error("unknown event type");
}

export function buildEvent(
    eventType: EventType,
    accountId: string,
    binderId: string,
    publicationId: string,
    title: string,
    sessionId: string,
): Event {
    const timestamp = new Date().getTime();
    return {
        eventType,
        accountId,
        data: buildEventData(eventType, binderId, publicationId, title, sessionId),
        timestamp,
        timestampLogged: timestamp,
    }
}

export function buildRelabelLanguageEvent(
    accountId: string,
    fromLanguageCode: string,
    toLanguageCode: string,
    itemId: string,
): Event {
    const timestamp = new Date().getTime();
    return {
        eventType: EventType.RELABEL_LANGUAGE,
        accountId,
        data: {
            fromLanguageCode,
            toLanguageCode,
            itemId,
        },
        timestamp,
        timestampLogged: timestamp,
    }
}

export function buildChunkBrowsedEvent(
    accountId: string,
    oldChunk: number,
    newChunk: number,
    sessionId: string,
    binderId: string,
    publicationId: string,
    timeSpent: number,
): Event {
    const timestamp = new Date().getTime();
    return {
        eventType: EventType.CHUNK_BROWSED,
        accountId,
        data: {
            oldChunk,
            newChunk,
            documentType: "publication",
            documentId: publicationId,
            binderId,
            collectionId: `col-parent-of-${binderId}`,
            timeSpend: timeSpent,
            words: 5,
            sessionId,
        },
        timestamp,
        timestampLogged: timestamp,
    }
}

export function buildChooseLanguageEvent(
    accountId: string,
    language: string,
    publicationId: string,
): Event {
    const timestamp = new Date().getTime();
    return {
        eventType: EventType.CHOOSE_LANGUAGE,
        accountId,
        data: {
            language,
            document: publicationId,
        },
        timestamp,
        timestampLogged: timestamp,
    }
}