import {
    ChunkTimingsMap,
    IAggregatorReportBody,
    IUserAction,
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { countWordsInHtml } from "@binders/client/lib/util/html";
import moment from "moment";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function completeUserActions(userActions: IUserAction[]) {
    return userActions.map((userAction: IUserAction) => ({
        ...userAction,
        start: userAction.start || new Date(),
    }))
}

export function mergeUserActionReportBodies(
    body1: IAggregatorReportBody | undefined,
    body2: IAggregatorReportBody | undefined,
): IAggregatorReportBody {
    if (!body1 || (body1.toAddCount + body1.toCompleteCount === 0)) { return body2; }
    if (!body2 || (body2.toAddCount + body2.toCompleteCount === 0)) { return body1; }
    const rs = {
        toAddCount: body1.toAddCount + body2.toAddCount,
        toCompleteCount: body1.toCompleteCount + body2.toCompleteCount,
        oldest: moment(body1.oldest).isBefore(body2.oldest) ? body1.oldest : body2.oldest,
        newest: moment(body1.newest).isAfter(body2.newest) ? body1.newest : body2.newest,
    }
    return rs;
}

export function initializeChunkTimingsMap(publication: Publication): ChunkTimingsMap {
    return publication.modules.text.chunked[0].chunks.reduce((acc, chunksArr, i) => {
        const wordCount = chunksArr.reduce((acc, html) => acc + countWordsInHtml(html), 0);
        return {
            ...acc,
            [i]: {
                wordCount,
                timeSpentMs: 0,
            }
        }
    }, {});
}