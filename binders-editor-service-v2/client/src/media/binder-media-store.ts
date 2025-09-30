import { IPreviewVisual, IVisualPosition } from "../documents/Composer/contract";
import {
    buildImageChunksByImageId,
    combineVisuals,
    extractVisualsFromBinder,
    thumbnailToVisual,
    toBinderVisual,
    visualFileToPreviewVisual
} from "./helper";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { FlashMessages } from "../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Visual as VisualClass } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualSettings } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { create } from "zustand";
import i18n from "@binders/client/lib/react/i18n/index";
import { isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { pick } from "ramda";
import { useCallback } from "react";

export type StoreVisual = VisualClass & {
    inUse?: boolean,
    chunks?: { [chunkIndex: number]: number[] }
};

export type NoDragging = { isDragging: false };
export type Dragging = {
    isDragging: true,
    draggingFrom: string,
    chunkIndexOfDraggingVisual: number,
    chunkIndexOfDraggingChunk: number,
};
export type DraggingInfo = NoDragging | Dragging;

export enum VisualsFetchState {
    NOT_STARTED = "NOT_STARTED",
    FETCHING = "FETCHING",
    SUCCESSFUL = "SUCCESSFUL",
    ERROR = "ERROR",
}

type BinderMediaStore = {
    visualsFetchState: VisualsFetchState;
    visuals: StoreVisual[];
    previewVisuals: Record<string, IPreviewVisual[]>;
    visualSettingsByPosition: Record<string, VisualSettings>;
    visualsUploadStartTime: Record<string, Date>;
    visualsTrimsByChunkIdx: Record<string, Pick<BinderVisual, "startTimeMs" | "endTimeMs">>;
    draggingInfo: DraggingInfo;
}

export const useBinderMediaStore = create<BinderMediaStore>(() => ({
    visualsFetchState: VisualsFetchState.NOT_STARTED,
    visuals: [],
    previewVisuals: {},
    visualSettingsByPosition: {},
    visualsUploadStartTime: {},
    visualsTrimsByChunkIdx: {},
    draggingInfo: { isDragging: false },
}));

export const useBinderVisualsFetchState = () =>
    useBinderMediaStore(state => state.visualsFetchState);

export const useBinderVisuals = () =>
    useBinderMediaStore(state => state.visuals);

export const useBinderPreviewVisuals = (binderId: string) => {
    const previewVisuals = useBinderMediaStore(state => state.previewVisuals);
    return previewVisuals[binderId] || [];
}

export const useBinderVisualTrim = (chunkIdx: number, visualIdx: number) => {
    return useBinderMediaStore(state => state.visualsTrimsByChunkIdx[chunkIdx + "-" + visualIdx]);
}

export const useGetVisualTrim = () => {
    const visualsTrimsByChunkIdx = useBinderMediaStore(state => state.visualsTrimsByChunkIdx);
    const getVisualTrim = useCallback((chunkIdx: number, visualIdx: number) => visualsTrimsByChunkIdx[chunkIdx + "-" + visualIdx], [visualsTrimsByChunkIdx]);
    return getVisualTrim;
}

export const useBinderVisualSettingsByChunk = (chunkIdx: number, visualIdx: number) =>
    useBinderMediaStore(state => state.visualSettingsByPosition[`${chunkIdx}-${visualIdx}`]);

export const useDraggingInfo = () =>
    useBinderMediaStore(state => state.draggingInfo);

export type UploadingVisualFile = File & { clientId: string };
export const BinderMediaStoreActions = {
    triggerVisualsFetch: async (binder, visualsFetcher: (id: string) => Promise<Visual[]>) => {
        try {
            const visualsInBinder = (binder.kind === "collection") ?
                [] :
                extractVisualsFromBinder(binder);
            useBinderMediaStore.setState(() => ({ visualsFetchState: VisualsFetchState.FETCHING }));
            const binderVisualsFromService = await visualsFetcher(binder.id);
            const binderVisuals = combineVisuals(visualsInBinder, binderVisualsFromService.map(toBinderVisual));
            useBinderMediaStore.setState(() => ({
                visuals: binderVisuals,
                visualsFetchState: VisualsFetchState.SUCCESSFUL
            }));
        } catch (e) {
            useBinderMediaStore.setState(() => ({ visualsFetchState: VisualsFetchState.ERROR }));
        }
    },
    putVisual: (visual: Visual) => {
        const mergeVisualData = (existingVisual: StoreVisual): StoreVisual => {
            // Keep prototype of existing visual (VisualClass), overlay new API visual fields,
            // and preserve computed store fields like inUse/chunks
            return Object.assign(
                Object.create(Object.getPrototypeOf(existingVisual)),
                existingVisual,
                toBinderVisual(visual),
                pick(["inUse", "chunks"], existingVisual)
            ) as StoreVisual;
        };
        useBinderMediaStore.setState(state => ({
            visuals: state.visuals.map(v => v.id === visual.id ? mergeVisualData(v) : v),
        }));
    },
    updateVisualProp: <T extends keyof VisualSettings>(visualId: string, prop: T, value: VisualSettings[T]) => {
        if (value == null) {
            return;
        }
        const assignPropToVisual = (visual: StoreVisual): StoreVisual =>
            Object.assign(Object.create(Object.getPrototypeOf(visual)), visual, { [prop]: value });
        useBinderMediaStore.setState(state => ({
            visuals: state.visuals.map(v => v.id === visualId ? assignPropToVisual(v) : v),
        }));
    },
    updateVisualSettingForVisualInChunk: (chunkIdx: number, visualIdx: number, visualSettings: Partial<VisualSettings>) => {
        if (chunkIdx == null || visualIdx == null) {
            return;
        }
        if (visualSettings == null || Object.keys(visualSettings).length === 0) {
            return;
        }
        useBinderMediaStore.setState(state => {
            const key = `${chunkIdx}-${visualIdx}`;
            const currentSettings = state.visualSettingsByPosition[key] ?? {};
            return {
                visualSettingsByPosition: {
                    ...state.visualSettingsByPosition,
                    [key]: {
                        ...currentSettings,
                        ...visualSettings,
                    } as VisualSettings,
                }
            };
        });
    },
    updateVisualTrim: (chunkIdx: number, visualIdx: number, trim: { startTimeMs: number; endTimeMs: number }) => {
        useBinderMediaStore.setState(state => ({
            visualsTrimsByChunkIdx: {
                ...state.visualsTrimsByChunkIdx,
                [chunkIdx + "-" + visualIdx]: trim,
            },
        }));
    },
    moveVisualTrim: (fromChunkIdx: number, fromVisualIdx: number, toChunkIdx: number, toVisualIdx: number) => {
        useBinderMediaStore.setState(state => {
            const fromTrim = state.visualsTrimsByChunkIdx[fromChunkIdx + "-" + fromVisualIdx];
            const toTrim = state.visualsTrimsByChunkIdx[toChunkIdx + "-" + toVisualIdx];
            return {
                visualsTrimsByChunkIdx: {
                    ...state.visualsTrimsByChunkIdx,
                    [fromChunkIdx + "-" + fromVisualIdx]: toTrim,
                    [toChunkIdx + "-" + toVisualIdx]: fromTrim,
                },
            }
        });
    },
    updateUsedVisuals: (binder: BinderClass, usedVisualIds: string[]) => {
        const imageChunks = binder.getModuleByKey("i1").data;
        const thumbnailVisual = isPlaceholderVisual(binder.getThumbnail().medium) ?
            [] :
            [thumbnailToVisual(binder.getThumbnail())];

        const normalizedImagesChunks = imageChunks.map(imageChunk => imageChunk.map(toBinderVisual));

        const imageChunksById = buildImageChunksByImageId([thumbnailVisual].concat(normalizedImagesChunks));
        const updateVisual = (visual: StoreVisual): StoreVisual => {
            return Object.assign(visual, {
                inUse: usedVisualIds.includes(visual.id),
                chunks: imageChunksById[visual.id] || {},
            });
        }
        useBinderMediaStore.setState(state => ({
            visuals: state.visuals.map(v => updateVisual(v)),
        }));
    },
    completeVisuals: (visualsToComplete: VisualClass[]) => {
        useBinderMediaStore.setState(state => {
            const filteredVisuals = visualsToComplete.filter(newVisual => !state.visuals.some(visual => visual.id === newVisual.id));
            const hasFilteredVisuals = filteredVisuals.length !== visualsToComplete.length;
            if (hasFilteredVisuals) {
                FlashMessages.info(i18n.t(TK.Visual_AlreadyUploaded));
            }
            const visualsAlreadyInStore = new Set(state.visuals.map(v => v.id));
            return {
                visuals: [
                    ...state.visuals,
                    ...visualsToComplete.filter(newVisual => !visualsAlreadyInStore.has(newVisual.id)),
                ],
            };
        });
    },
    deleteVisual: (visualId: string) => {
        useBinderMediaStore.setState(state => ({
            visuals: state.visuals.filter(visual => visual.id !== visualId),
        }));
    },
    /** **WARNING: Will not trigger rerenders on visuals update** */
    getVisual: (visualId: string) => {
        return useBinderMediaStore.getState().visuals.find(visual => visual.id === visualId);
    },
    acceptVisuals: (binderId: string, visualFiles: UploadingVisualFile[], positions: IVisualPosition[] = []) => {
        useBinderMediaStore.setState(state => {
            const previewVisualsForBinder = [
                ...(state.previewVisuals[binderId] || []),
                ...visualFiles.map((visualFile) => visualFileToPreviewVisual(visualFile, positions))
            ];
            const now = new Date();
            const binderNewFilesUploadStartTimes = Object.fromEntries(
                visualFiles.map(visualFile => [visualFile.clientId, now])
            );
            return {
                previewVisuals: {
                    ...state.previewVisuals,
                    [binderId]: previewVisualsForBinder,
                },
                visualsUploadStartTime: {
                    ...state.visualsUploadStartTime,
                    ...binderNewFilesUploadStartTimes,
                },
            };
        });
    },
    updateVisualUploadProgress: (binderId: string, clientId: string, percentUploaded: number) => {
        useBinderMediaStore.setState(state => {
            const binderPreviewVisuals = state.previewVisuals[binderId] || [];
            const newBinderPreviewVisuals = binderPreviewVisuals.map(previewVisual =>
                previewVisual.id === clientId ? { ...previewVisual, percentUploaded } : previewVisual
            );
            return {
                previewVisuals: {
                    ...state.previewVisuals,
                    [binderId]: newBinderPreviewVisuals,
                }
            };
        });
    },
    deletePreviewVisuals: (binderId: string, clientIds: string[]) => {
        useBinderMediaStore.setState(state => {
            const newBinderPreviewVisuals = (state.previewVisuals[binderId] ?? [])
                .filter(previewVisual => !clientIds.includes(previewVisual.id));
            return {
                previewVisuals: {
                    ...state.previewVisuals,
                    [binderId]: newBinderPreviewVisuals,
                }
            };
        });
    },
    setDraggingInfo: (draggingInfo: DraggingInfo) => {
        useBinderMediaStore.setState(() => ({ draggingInfo }));
    },
    clearVisualsData: () => {
        useBinderMediaStore.setState(() => ({
            visualsFetchState: VisualsFetchState.NOT_STARTED,
            visuals: [],
            previewVisuals: {},
            visualsTrimsByChunkIdx: {},
            visualSettingsByPosition: {},
        }));
    }
}
