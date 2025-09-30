import { ReaderEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { ParentPathContext } from "./contract";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TrackingStoreGetters } from "../stores/zustand/tracking-store";
import { UserStoreGetters } from "../stores/zustand/user-store";
import { buildAncestorsObject } from "@binders/client/lib/ancestors";
import eventQueue from "@binders/client/lib/react/event/EventQueue";

function parentPathFromRoute(pathname: string, itemIdsToIgnore: string[]): string {
    const manualToRoutes = [ManualToRoutes.LAUNCH, ManualToRoutes.READ].map(r => r.replace(/\//g, ""));
    const partsToIgnore = [...manualToRoutes, ...itemIdsToIgnore];
    return pathname.split("/").filter(p => !(partsToIgnore.includes(p))).join("/");
}

export function getSingleParentPath(
    binderId: string,
    publicationId: string,
    parentPathContext: ParentPathContext,
    pathnameFromRouter?: string, // only provided in launch (non semantic) routes
): string {
    const { ancestors } = parentPathContext;
    const multiParentsInPath = Object.values(ancestors).some(parentIds => parentIds.length > 1);
    if (multiParentsInPath) {
        return pathnameFromRouter ? parentPathFromRoute(pathnameFromRouter, [binderId, publicationId]) : undefined;
    }
    const ancestorObject = buildAncestorsObject([binderId], ancestors);
    const ancestorIds = ancestorObject[binderId];
    return `/${[...ancestorIds].reverse().join("/")}`;
}

export function logDocumentOpened(
    publication: Publication,
    parentPathContext: ParentPathContext,
    accountId: string,
    pathnameFromRouter?: string,
    semanticLinkId?: string,
): void {
    const userId = UserStoreGetters.getUserId();
    const path = getSingleParentPath(publication.binderId, publication.id, parentPathContext, pathnameFromRouter);
    eventQueue.log(
        EventType.DOCUMENT_OPENED,
        accountId,
        {
            binderId: publication.binderId,
            documentId: publication.id,
            documentType: "publication",
            sessionId: TrackingStoreGetters.getTrackingDocumentSessionId(),
            title: publication.language.storyTitle,
            path,
            semanticLinkId,
        },
        false,
        userId,
    );
    captureFrontendEvent(ReaderEvent.DocumentOpened, {
        binderId: publication.binderId,
        documentId: publication.id,
        documentType: "publication",
        sessionId: TrackingStoreGetters.getTrackingDocumentSessionId(),
        title: publication.language.storyTitle,
        path,
        semanticLinkId,
    });
}
