import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { ComposerSession } from "../contract";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getCurrentUserId } from "../../../stores/my-details-store";

const lastEditSessionLogged = {
    sessionId: undefined,
    when: undefined,
};
const EDIT_SESSION_LOG_INTERVAL = 15 * 60 * 1000;


export const maybeLogEditSession = (
    accountId: string,
    session: ComposerSession,
): void => {
    const userId = getCurrentUserId();
    const now = new Date().getTime();
    let newWhen = lastEditSessionLogged.when;
    if (
        (lastEditSessionLogged.sessionId !== session.sessionId) ||
        (lastEditSessionLogged.when && (now - lastEditSessionLogged.when > EDIT_SESSION_LOG_INTERVAL))
    ) {
        eventQueue.log(
            EventType.BINDER_EDITED,
            accountId,
            <unknown>session as Record<string, unknown>,
            false,
            userId
        );
        newWhen = now;
        captureFrontendEvent(EditorEvent.DocumentEdited);
    }
    lastEditSessionLogged.when = newWhen;
    lastEditSessionLogged.sessionId = session.sessionId;
}
