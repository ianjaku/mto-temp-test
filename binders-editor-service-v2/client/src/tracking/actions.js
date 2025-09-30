import { Application, EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import eventQueue from "@binders/client/lib/react/event/EventQueue";

export const ItemKind = {
    BINDER: "binder",
    COLLECTION: "collection"
};

export const collectionOrDocumentToTrackingItemKind = (kind) => {
    if (kind === ItemKind.COLLECTION) return ItemKind.COLLECTION;
    if (kind === ItemKind.BINDER || kind === "document") return ItemKind.BINDER;
    throw new Error(`Item kind ${kind} not recognized`);
}

export const logUserIsOnline = (
    accountId,
    userId,
    isAdminImpersonatedSession = false,
    urgent = false
) => {
    if (!userId || userId === "public") {
        // eslint-disable-next-line
        console.error("Attempt to log online event as public.");
        return;
    }
    if(isAdminImpersonatedSession) {
        return;
    }
    eventQueue.log(
        EventType.USER_IS_ONLINE,
        accountId,
        { application: Application.EDITOR, userId },
        urgent,
        userId,
    );
}
