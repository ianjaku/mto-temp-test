import * as React from "react";
import BinderClass, { curriedMultiUpdate } from "@binders/client/lib/binders/custom/class";
import type { Dispatch, FC, PropsWithChildren, SetStateAction } from "react";
import {
    captureEventDiffAccept,
    captureEventDiffAcceptAll,
    captureEventDiffCancel,
    captureEventDiffConfirm,
    captureEventDiffReject,
    captureEventDiffRetry,
    computeEventBinderDiffProps,
} from "./events";
import { createContext, useContext, useMemo, useState } from "react";
import { deserializeEditorStates, serializeEditorStates } from "@binders/client/lib/draftjs/helpers";
import {
    useBinderChunkUpdate,
    useBinderContentUpdate,
    useChunkAiOptimization,
    useEventBinderContextProps,
    useEventBinderDiffProps,
} from "./hooks";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useBinderUpdate } from "./BinderUpdateProvider";

type BinderDiffContext = {
    binderDiff: Binder;
    binderDiffObj: BinderClass;
    binderDiffStateMap: BinderDiffStateMap;
    setBinderDiff: Dispatch<SetStateAction<Binder>>;
    setChunkDiffState: (langIdx: number, chunkIdx: number, diffState: ChunkDiffState) => void;
    resetChunkDiffState: (langIdx: number, chunkIdx: number) => void;
    resetChunkDiffStates: () => void;
}

type BinderLanguageDiffContext = {
    acceptAllChanges: () => void;
    acceptChunkChanges: (chunkIdx: number) => void;
    rejectChunkChanges: (chunkIdx: number) => void;
    retryChunk: (chunkIdx: number) => void;
    closeDiffView: (commit: boolean) => void;
}

type ChunkDiffState = "Diff" | "NoDiff_Changed" | "NoDiff_Original";

const binderDiffContext = createContext<BinderDiffContext>({
    binderDiff: null,
    binderDiffObj: null,
    binderDiffStateMap: null,
    setChunkDiffState: null,
    setBinderDiff: null,
    resetChunkDiffState: null,
    resetChunkDiffStates: null,
});

const binderLanguageDiffContext = createContext<BinderLanguageDiffContext>({
    acceptAllChanges: null,
    acceptChunkChanges: null,
    rejectChunkChanges: null,
    retryChunk: null,
    closeDiffView: null,
});

type BinderDiffStateMap = {
    [langIdx: number]: {
        [chunkIdx: number]: ChunkDiffState;
    };
}

export const BinderDiffProvider: FC<PropsWithChildren<Record<never, never>>> = ({ children }) => {
    const [binderDiff, setBinderDiff] = useState<Binder | undefined>(undefined);
    const [binderDiffStateMap, setBinderDiffStateMap] = useState<BinderDiffStateMap>({});

    const binderDiffObj = useMemo(() => {
        if (!binderDiff) return undefined;
        return new BinderClass({
            ...deserializeEditorStates(binderDiff),
            contentVersion: Date.now(),
        } as Binder);
    }, [binderDiff]);

    const setChunkDiffState = (langIdx: number, chunkIdx: number, diffState: ChunkDiffState) => {
        setBinderDiffStateMap(prev => ({
            ...prev,
            [langIdx]: {
                ...(prev[langIdx] ?? {}),
                [chunkIdx]: diffState,
            }
        }));
    }

    const resetChunkDiffStates = () => {
        setBinderDiffStateMap({});
    }

    const resetChunkDiffState = (langIdx: number, chunkIdx: number) => {
        setBinderDiffStateMap(prev => {
            const chunkKey = chunkIdx.toString();
            const prevWithoutChunk = Object.fromEntries(
                Object.entries(prev[langIdx] ?? {}).filter(([k]) => k !== chunkKey)
            );
            return {
                ...prev,
                [langIdx]: {
                    ...prevWithoutChunk,
                }
            }
        });
    }

    return (
        <binderDiffContext.Provider
            value={{
                binderDiff,
                binderDiffObj,
                binderDiffStateMap,
                setBinderDiff,
                setChunkDiffState,
                resetChunkDiffState,
                resetChunkDiffStates,
            }}
        >
            {children}
        </binderDiffContext.Provider>
    )
}

export const useBinderDiff = (): BinderDiffContext => {
    const ctx = useContext(binderDiffContext);
    if (!ctx.setBinderDiff) {
        throw new Error("useBinderDiff was used, but BinderDiffProvider was not initialized. Make sure it exists in the hierarchy above and all properties are set");
    }
    return ctx;
}

export const BinderLanguageDiffProvider: FC<PropsWithChildren<{ languageCode: string }>> = ({ children, languageCode }) => {
    const { binder } = useBinderUpdate()
    const { binderDiff, binderDiffObj, setBinderDiff, setChunkDiffState, resetChunkDiffStates } = useBinderDiff();

    const langIdx = useMemo(() => binder.getLanguageIndex(languageCode), [binder, languageCode]);

    const eventBinderContextProps = useEventBinderContextProps({ binder, langIdx });
    const eventBinderDiffProps = useEventBinderDiffProps({ langIdx });

    const eventContext = useMemo(() => ({
        ...eventBinderContextProps,
        ...eventBinderDiffProps,
    }), [eventBinderContextProps, eventBinderDiffProps]);

    const updateBinder = useBinderContentUpdate();
    const updateChunk = useBinderChunkUpdate({
        binder,
        updateBinder: binderUpdate => {
            const update = curriedMultiUpdate(binderUpdate.patches, true);
            const updated = update(binder);
            updateBinder(updated, langIdx);
        },
    });

    const acceptAllChanges = () => {
        if (binderDiffObj) {
            updateBinder(binderDiffObj, langIdx);
            setBinderDiff(null);
            resetChunkDiffStates();
            captureEventDiffAcceptAll(eventContext);
        }
    }

    const acceptChunkChanges = (chunkIdx: number) => {
        updateChunk(binderDiff, langIdx, chunkIdx);
        setChunkDiffState(langIdx, chunkIdx, "NoDiff_Changed");
        captureEventDiffAccept({
            ...eventContext,
            ...computeEventBinderDiffProps(binder, binderDiffObj, { langIdx, chunkIdx }),
        });
    };

    const rejectChunkChanges = (chunkIdx: number) => {
        setChunkDiffState(langIdx, chunkIdx, "NoDiff_Original");
        captureEventDiffReject({
            ...eventContext,
            ...computeEventBinderDiffProps(binder, binderDiffObj, { langIdx, chunkIdx }),
        });
    }

    const closeDiffView = (commit: boolean) => {
        setBinderDiff(null);
        resetChunkDiffStates();
        if (commit) {
            captureEventDiffConfirm(eventContext);
        } else {
            captureEventDiffCancel(eventContext);
        }
    }

    const { apply: optimizeChunk } = useChunkAiOptimization(
        binderDiffObj,
        langIdx,
        binderUpdate => {
            const update = curriedMultiUpdate(binderUpdate.patches, true);
            const updated = update(binderDiffObj);
            setBinderDiff(serializeEditorStates(updated.toJSON()));
        },
    );

    const retryChunk = (chunkIdx: number) => {
        optimizeChunk(chunkIdx);
        captureEventDiffRetry({
            ...eventContext,
            ...computeEventBinderDiffProps(binder, binderDiffObj, { langIdx, chunkIdx }),
        });
    }

    return (
        <binderLanguageDiffContext.Provider
            value={{
                acceptAllChanges,
                acceptChunkChanges,
                rejectChunkChanges,
                retryChunk,
                closeDiffView,
            }}
        >
            {children}
        </binderLanguageDiffContext.Provider>
    )
}

export const useBinderLanguageDiff = (): BinderLanguageDiffContext => {
    const ctx = useContext(binderLanguageDiffContext);
    if (!ctx.acceptAllChanges) {
        throw new Error("useBinderLanguageDiff was used, but BinderLanguageDiffProvider was not initialized. Make sure it exists in the hierarchy above and all properties are set");
    }
    return ctx;
}
