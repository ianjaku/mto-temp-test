import {
    ServerEvent,
    captureServerEvent as captureServerEventAsync
} from "@binders/binders-service-common/lib/tracking/capture";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    incrementDuplicateTextModulesConflictCounter
} from "@binders/binders-service-common/lib/monitoring/prometheus/duplicateTextModulesConflict";

const isEmptyTextModule = (textModule) => {
    return textModule.chunks.map(chunkArr => chunkArr.join("")).join("").trim() === "";
};

/**
 * Deduplicates text module keys in a binder by removing empty duplicate modules.
 * If duplicate keys are found and at least one of the duplicates is empty, the empty ones are removed.
 * If duplicate keys are found but all duplicates have content, an conflict counter is incremented in prometheus
 *
 * @param binder - The binder object to process
 * @param userId - The ID of the user performing the operation
 * @returns A new binder object with deduplicated text modules, or the original if no changes were made
 */
export const deduplicateTextModuleKeys = (binder: Binder, userId: string): Binder => {

    const keys = new Set<string>();
    const duplicateKeys = new Set<string>();

    for (const textModule of binder.modules.text.chunked) {
        if (keys.has(textModule.key)) {
            duplicateKeys.add(textModule.key);
        } else {
            keys.add(textModule.key);
        }
    }

    if (duplicateKeys.size === 0) {
        return binder;
    }

    const removedKeys = [];

    const newTextModulesChunked = binder.modules.text.chunked.reduce((acc, textModule) => {
        if (duplicateKeys.has(textModule.key) && isEmptyTextModule(textModule)) {
            removedKeys.push(textModule.key);
            return acc;
        }
        return [...acc, textModule];
    }, []);

    if (removedKeys.length > 0) {
        // keys of empty text modules were removed, capture the event for informative monitoring
        captureServerEventAsync(
            ServerEvent.DuplicateTextModuleKeys,
            { userId, accountId: binder.accountId },
            {
                binderId: binder.id,
                duplicateKeys: Array.from(duplicateKeys).join(","),
                removedKeys: removedKeys.join(","),
            }
        );
    } else {
        // duplicates found but keys were not removed, bug in MT-5467 might persist, capture to prometheus for more urgent monitoring
        incrementDuplicateTextModulesConflictCounter({
            binderId: binder.id,
            accountId: binder.accountId,
            duplicateKeys: Array.from(duplicateKeys).join(","),
        });
    }

    return {
        ...binder,
        modules: {
            ...binder.modules,
            text: {
                ...binder.modules.text,
                chunked: newTextModulesChunked,
            },
        },
    }

}
