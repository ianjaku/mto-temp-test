import * as React from "react";
import { isFeedbackChunk, isHiddenChunk, isManualToChunk, isReadConfirmationChunk, isTitleChunk } from "./utils";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ContentChunkProps } from "./types";
import { IChecklist } from "@binders/client/lib/clients/repositoryservice/v3/contract";

const { useMemo } = React;

export type UseChunksMapsProps = Pick<ContentChunkProps, "binderLog" | "checklists" | "chunks" | "chunksImages">;

export type UseChunksMaps = {
    chunkIdByIndex: Record<string, string>;
    chunkImagesMap: number[];
    checklistByChunkId: Record<string, IChecklist>;
    chunksKinds: ContentChunkKind[];
}

export function useChunksMaps({ binderLog, checklists, chunks, chunksImages }: UseChunksMapsProps): UseChunksMaps {
    const chunkIdByIndex = useMemo(
        () => {
            if (!binderLog) return {} as UseChunksMaps["chunkIdByIndex"];
            return chunks.reduce((byIndex, _chunk, index) => ({
                ...byIndex,
                [index]: binderLog.current.find(e => e.position === index)?.uuid,
            }), {})
        },
        [binderLog, chunks],
    );

    const checklistByChunkId = useMemo(
        () => {
            if (!checklists) return {} as UseChunksMaps["checklistByChunkId"];
            return checklists.reduce((byChunkId, cl) => ({
                ...byChunkId,
                [cl.chunkId]: cl,
            }), {});
        },
        [checklists],
    );

    const chunksKinds = useMemo(
        () =>
            chunks.map((chunk, chunkIndex) => {
                if (isManualToChunk(chunk)) {
                    return ContentChunkKind.MadeByManualTo;
                }
                if (isFeedbackChunk(chunk)) {
                    return ContentChunkKind.Feedback;
                }
                if (isHiddenChunk(chunk)) {
                    return ContentChunkKind.Hidden;
                }
                if (isTitleChunk(chunk)) {
                    return ContentChunkKind.TitleChunk;
                }
                if (isReadConfirmationChunk(chunk)) {
                    return ContentChunkKind.ReadConfirmation;
                }
                const chunkId = chunkIdByIndex[chunkIndex];
                const checklist = !chunkId || isManualToChunk(chunk) ? undefined : checklistByChunkId[chunkId];
                const chunkKind = checklist ? ContentChunkKind.Checklist : ContentChunkKind.Html;
                return chunkKind;
            }),
        [checklistByChunkId, chunkIdByIndex, chunks],
    );

    const chunkImagesMap = useMemo(() => {
        let lastImageIndex = 0;
        return chunks.map((_, index) => {
            if (index === 0) {
                return 0;
            }
            if (chunksImages && chunksImages[index] && chunksImages[index].length > 0) {
                lastImageIndex++;
            }
            return lastImageIndex;
        });

    }, [chunks, chunksImages]);

    return {
        checklistByChunkId,
        chunkIdByIndex,
        chunkImagesMap,
        chunksKinds,
    }
}
