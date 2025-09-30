import Binder from "@binders/client/lib/binders/custom/class";

export type IChunkProps = {
    binder: Binder;
    chunkId: string;
    includeChecklist: boolean;
    isEmpty: boolean;
    languageCode: string;
    onChunkOperation?: (index: number, operation: number, isSecondary?: boolean, isEmptyChunk?: boolean) => void;
}
