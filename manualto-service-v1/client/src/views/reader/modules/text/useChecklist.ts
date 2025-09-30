import * as React from "react";
import {
    IBinderLog,
    IChecklist,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import { UseChunkBoundaries, useChunkBoundaries } from "./useChunkBoundaries";
import { UseChunksMaps, useChunksMaps } from "./useChunksMaps";
import { UseClosestChunk, useClosestChunk } from "./useClosestChunk";
import { animateToChunk, getChunkElements, logChecklistCompleted } from "./utils";
import { APITogglePerformed } from "../../../../api/repositoryService";
import { ActiveDocument } from "../../../../stores/zustand/binder-store";
import {
    ChecklistAlreadyInThatStateError
} from "@binders/client/lib/clients/repositoryservice/v3/errors";
import {
    FEATURE_BLOCK_CHECKLIST_PROGRESS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { TranslationKeys } from "@binders/client/lib/i18n/translations";
import {
    getMostRecentHistoryItem
} from "@binders/client/lib/clients/repositoryservice/v3/checklists/helpers";
import { loadChecklistsAsync } from "../../../../binders/binder-loader";
import { useActiveChunkIndex } from "../../../../stores/hooks/chunk-position-hooks";
import { useChecklistStoreActions } from "../../../../stores/zustand/checklist-store";
import { useIsAccountFeatureActive } from "../../../../stores/hooks/account-hooks";

const { useCallback, useEffect, useMemo, useRef, useState } = React;

export type UseChecklistProps = {
    accountId: string;
    binderId: string;
    binderLog: IBinderLog | null;
    checklists: IChecklist[];
    chunks: string[][];
    translations: string[];
    chunksImages: string[][];
    isLandscape: boolean;
    userId: string;
    viewable: ActiveDocument;
}

export type UseChecklist = UseChunksMaps & UseClosestChunk & UseChunkBoundaries & {
    blockNextChunkScroll: () => boolean;
    blockProgressWarningShown: boolean;
    blockScroll: (atTheBottom: boolean) => boolean;
    blockingChunkIndex: number;
    checklistsReset: boolean;
    closest: number;
    handleTogglePerformed: (checklistId: string, performed: boolean) => void;
    hideBlockProgressWarning: () => void;
    setTextModuleRef: (el: HTMLElement) => void;
    showBlockProgressWarning: () => void;
}

export function useChecklist({
    accountId,
    binderId,
    binderLog,
    checklists,
    chunks: originalChunks,
    translations: machineTranslatedChunks,
    chunksImages,
    isLandscape,
    userId,
    viewable,
}: UseChecklistProps): UseChecklist {
    const [blockChecklistProgressWarningKey, setBlockChecklistProgressWarningKey] = useState<string>();
    const [blockProgressWarningShown, setBlockProgressWarningShown] = useState<boolean>()
    const [blockingChunkIndex, setBlockingChunkIndex] = useState<number>();
    const textModuleRef = useRef<HTMLElement>();
    const { t } = useTranslation();
    const checklistProgressBlock = useIsAccountFeatureActive(FEATURE_BLOCK_CHECKLIST_PROGRESS);
    const { patchChecklists } = useChecklistStoreActions();

    const chunks = machineTranslatedChunks ?
        machineTranslatedChunks.map(c => [c]) :
        originalChunks;

    const { checklistByChunkId, chunksKinds, chunkIdByIndex, chunkImagesMap, ...restChunksMap } = useChunksMaps({
        binderLog, checklists, chunks, chunksImages,
    });

    const checklistsReset = useMemo(() => checklists && checklists.every(c => c.performed), [checklists]);
    const previousChecklistByChunkId = usePrevious(checklistByChunkId);
    const { closest, setClosest } = useClosestChunk({ chunkImagesMap });
    const boundaries = useChunkBoundaries({ setClosest, textModuleRef });

    const showBlockProgressWarning = useCallback(() => {
        setBlockChecklistProgressWarningKey(FlashMessageActions.warning(t(TranslationKeys.Reader_ChecklistProgressBlocked)));
        setBlockProgressWarningShown(true);
    }, [t]);

    const hideBlockProgressWarning = useCallback(() => {
        FlashMessageActions.dismissMessage(blockChecklistProgressWarningKey);
        setBlockProgressWarningShown(false);
    }, [blockChecklistProgressWarningKey]);

    const setTextModuleRef = useCallback((ref: HTMLElement) => {
        textModuleRef.current = ref;
    }, [textModuleRef]);

    const scrollToChunk = useCallback((idx: number) => {
        setTimeout(() => {
            if (!textModuleRef.current) return;
            const elements = getChunkElements(textModuleRef.current)
            animateToChunk(elements[idx], isLandscape); // auto scroll to the next chunk when the checklist button is checked
        }, 300);
    }, [textModuleRef, isLandscape]);

    const { progressDetected, firstUnperformedIdx, receivedChecklist } = useMemo(() => {
        const progress = chunks.map((_, i) => {
            if (!checklistByChunkId[chunkIdByIndex[i]]) return null; // Null means there is no checklist at this chunk index
            return checklistByChunkId[chunkIdByIndex[i]]?.performed
        });
        const prevProgress = progress.map((_, i) => previousChecklistByChunkId?.[chunkIdByIndex[i]]?.performed);
        const progressDetected = prevProgress.some((c, i) => c === false && progress[i] === true);
        const firstChangedIdx = progress.map((c, i) => !!c === !!prevProgress[i]).findIndex((c) => !c);
        const firstUnperformedIdx = progress.findIndex((c, i) => c === false && i >= firstChangedIdx);
        const receivedChecklist = checklists?.length > 0 && !previousChecklistByChunkId
        return { progressDetected, firstUnperformedIdx, receivedChecklist };
    }, [checklists, checklistByChunkId, chunkIdByIndex, previousChecklistByChunkId, chunks])

    const handleTogglePerformed = useCallback((checklistId: string, performed: boolean) => {
        if (!checklists || checklistsReset) {
            return;
        }
        updateChecklistState(
            t,
            checklistId,
            performed,
            binderId,
            viewable.id,
            patchChecklists,
        );
        if (performed) {
            const otherChecklists = checklists.filter(c => c.id !== checklistId);
            const allOtherChecklistsPerformed = otherChecklists.every(c => c.performed);
            if (allOtherChecklistsPerformed) {
                logChecklistCompleted(
                    accountId,
                    userId,
                    viewable as Publication,
                    binderId,
                );
            }
        }
    }, [accountId, binderId, checklists, checklistsReset, patchChecklists, t, userId, viewable]);

    const getCheckListForChunkIndex = useCallback((index: number) => {
        const chunkId = chunkIdByIndex[index];
        return chunkId && checklistByChunkId[chunkId];
    }, [checklistByChunkId, chunkIdByIndex]);

    const blockScroll = useCallback((atTheBottom: boolean) => {
        const checklist = getCheckListForChunkIndex(closest);
        const notPerformed = checklist && !checklist.performed;
        const notTheLastChunk = closest + 1 < chunks.length;
        const isBlocking = checklists && checklistProgressBlock;
        if (isBlocking && atTheBottom && notTheLastChunk && notPerformed) {
            if (!blockProgressWarningShown) {
                showBlockProgressWarning();
            }
            return true;
        }
        return false;
    }, [blockProgressWarningShown, closest, chunks.length, checklistProgressBlock, checklists, getCheckListForChunkIndex, showBlockProgressWarning]);


    const activeChunkIndex = useActiveChunkIndex();
    useEffect(() => {
        const isValidIdx = firstUnperformedIdx <= blockingChunkIndex;
        if (progressDetected) {
            scrollToChunk(activeChunkIndex + 1);
        }
        if (isValidIdx) {
            setBlockingChunkIndex(firstUnperformedIdx);
        }
    }, [blockingChunkIndex, progressDetected, firstUnperformedIdx, receivedChecklist, scrollToChunk, activeChunkIndex]);

    useEffect(() => {
        if (firstUnperformedIdx > -1) {
            setBlockingChunkIndex(firstUnperformedIdx);
        }
    }, [firstUnperformedIdx]);

    return {
        blockNextChunkScroll: () => blockScroll(true),
        blockProgressWarningShown,
        blockScroll,
        blockingChunkIndex,
        checklistByChunkId,
        checklistsReset,
        chunkIdByIndex,
        chunkImagesMap,
        chunksKinds,
        closest,
        handleTogglePerformed,
        hideBlockProgressWarning,
        setClosest,
        setTextModuleRef,
        showBlockProgressWarning,
        ...boundaries,
        ...restChunksMap,
    }
}

async function updateChecklistState(
    t: TFunction,
    checklistId: string,
    performed: boolean,
    binderId: string,
    viewableId: string, // checklists only exist on publications, so this will always be the publicationId
    patchFn: (checklist: IChecklist) => void,
) {
    try {
        const checklist = await APITogglePerformed(
            checklistId,
            performed,
            binderId,
            viewableId
        );
        patchFn(checklist);
    } catch (e) {
        if (e.errorDetails?.name === ChecklistAlreadyInThatStateError.NAME) {
            const checklist = e.errorDetails?.checklist;
            const historyItem = getMostRecentHistoryItem(checklist);
            const name = historyItem?.lastPerformedByUserName ?? "unknown";
            const translationKey = performed ? TK.Checklists_AlreadyPerformed : TK.Checklists_AlreadyUnperformed;
            FlashMessageActions.warning(t(translationKey, { name }), 10000);
            patchFn(checklist);
            loadChecklistsAsync(checklist.binderId);
        } else {
            throw e;
        }
    }
}

function usePrevious<T>(value: T) {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

