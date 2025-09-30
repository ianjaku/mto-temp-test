import { ApprovedStatus, IChunkApproval, IChunkCurrentPositionLog } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Binder from "@binders/client/lib/binders/custom/class";

export function getBinderLogEntry(binder: Binder, chunkPosition: number): IChunkCurrentPositionLog {
    return binder.getBinderLog().current.find(log => log.position === chunkPosition);
}

export function findApproval(
    chunkApprovals: IChunkApproval[],
    logEntry: IChunkCurrentPositionLog,
    languageCode: string,
    binderId?: string,
): IChunkApproval {
    return !chunkApprovals || (!logEntry && !binderId) ?
        undefined :
        chunkApprovals
            .filter(app => app.chunkLanguageCode === languageCode && !!app.chunkId)
            .find(app => logEntry ? app.chunkId === logEntry.uuid : app.chunkId === binderId);
}

export function approvalsWithStatus(
    chunkApprovals: IChunkApproval[],
    chunkId: string,
    approvedStatus: ApprovedStatus,
): IChunkApproval[] {
    if (!chunkApprovals || !chunkId) {
        return [];
    }
    return chunkApprovals.filter(appr =>
        !!appr.chunkId && appr.chunkId === chunkId && appr.approved === approvedStatus
    );
}