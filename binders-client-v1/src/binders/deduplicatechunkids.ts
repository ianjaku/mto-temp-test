import { Binder } from "../clients/repositoryservice/v3/contract";
import UUID from "../util/uuid";


export const deduplicateChunkIds = (binder: Binder): Binder => {
    if (binder.binderLog == null) return binder;
    const chunkIds = new Set<string>();

    const newBinderLogs = binder.binderLog.current.map(binderLog => {
        if (!chunkIds.has(binderLog.uuid)) {
            chunkIds.add(binderLog.uuid);
            return binderLog;
        }

        return {
            ...binderLog,
            uuid: UUID.random().toString(),
        };
    });
    
    return {
        ...binder,
        binderLog: {
            ...binder.binderLog,
            current: newBinderLogs
        }
    };
}
