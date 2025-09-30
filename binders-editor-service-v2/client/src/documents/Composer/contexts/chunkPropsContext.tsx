import * as React from "react";
import { FC, ReactNode, useContext, useMemo } from "react";
import {
    useBinderLanguageComputedProps,
    useBinderLanguageOperations,
    useBinderLanguageProps
} from "./binderLanguagePropsContext";
import { useComposerComputedProps, useComposerProps } from "./composerPropsContext";
import Binder from "@binders/client/lib/binders/custom/class";
import { ChunkOperation } from "../components/BinderLanguage/ChunkControls/contract";
import { EditorState } from "draft-js";
import { IChecklistConfig } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IModuleSet } from "../components/BinderLanguage/types";
import { isLanguageRTL } from "@binders/client/lib/languages/helper";

type ChunkContextProps = {
    index: number;
}

export type ChunkPropsContextType = {
    checklistConfig: IChecklistConfig;
    chunkIndex: number;
    includeVisuals?: boolean;
    isActiveVersion?: number; // holds an int if the chunk is active, is undefined if chunk is inactive
    isDisabled?: boolean;
    isLastOfType?: boolean;
    isPrimary?: boolean;
    isRTL?: boolean;
    isTitle?: boolean;
    isTranslating?: boolean;
    languageCode: string;
    moduleSet: IModuleSet;
    onBlur?: () => void;
    onChange?: (
        newValue: string | EditorState, // string for title, EditorState for chunk updates via draft
        json: string | undefined, // chunk updates via tiptap
        html: string | undefined, // chunk updates via tiptap
        metaKey: string,
        chunkIndex: number,
        bumpContentVersion?: boolean,
        postBinderAction?: (binder: Binder) => Promise<void>
    ) => void;
    onTranslate?: () => void;
    onInjectNewAtEnd?: () => void;
    opposingChunkIsEmpty: boolean;
    renderAsTextArea?: boolean;
    secondaryFieldSelected?: boolean;
    uuid: string;
    zeroBasedChunkIndex: number;
}

const ChunkPropsContext = React.createContext<ChunkPropsContextType>({} as ChunkPropsContextType);

export const ChunkPropsContextProvider: FC<{
    children: ReactNode;
    props: ChunkContextProps;
}> = (ctxProps) => {
    const {
        children,
        props,
    } = ctxProps;
    const computed = useBuildChunkComputedProps(props);
    return (
        <ChunkPropsContext.Provider value={computed}>
            {children}
        </ChunkPropsContext.Provider>
    );
}

export const useChunkProps = (): ChunkPropsContextType => {
    const props = useChunkContext();
    return props;
}

const useChunkContext = (): ChunkPropsContextType =>
    useContext(ChunkPropsContext);

const useBuildChunkComputedProps = (props: ChunkContextProps): ChunkPropsContextType => {
    const { index } = props;

    const { isMobile, selectedChunkDetails } = useComposerProps();
    const { translatorLanguageCodes } = useComposerComputedProps();

    const {
        includeVisuals,
        isPrimary,
        languageCode,
    } = useBinderLanguageProps();
    const {
        checklistConfigs,
        chunkCount,
        isDisabled,
        moduleSets,
        opposingModuleSets,
        opposingTitleModuleSet,
        titleModuleSet,
    } = useBinderLanguageComputedProps();
    const { buildOnTranslate, isTranslating, onUpdateChunkText, onUpdateTitle, onChunkOperation } = useBinderLanguageOperations();

    const chunkIndex = index + 1;
    const zeroBasedChunkIndex = index;

    const isRTL = languageCode ? isLanguageRTL(languageCode) : false;

    const isActiveVersion = selectedChunkDetails.isPrimary === isPrimary && selectedChunkDetails.index === (index + 1) ?
        selectedChunkDetails?.version :
        undefined;
    const secondaryFieldSelected = !selectedChunkDetails.isPrimary && selectedChunkDetails.index === (index + 1);

    const isTitleChunk = chunkIndex === 0;

    const moduleSet = isTitleChunk ? titleModuleSet : moduleSets[index];
    const onChange = isTitleChunk ? onUpdateTitle : onUpdateChunkText;
    const onInjectNewAtEnd = () => {
        onChunkOperation(chunkCount, ChunkOperation.add, !isPrimary);
    }

    const opposingModuleSet = opposingModuleSets[zeroBasedChunkIndex];
    const onTranslate = buildOnTranslate(moduleSet, opposingModuleSet, chunkIndex, translatorLanguageCodes)

    const opposingChunkIsEmpty = isTitleChunk ? opposingTitleModuleSet?.isEmpty : opposingModuleSet?.isEmpty;

    const { uuid } = moduleSet;

    const checklistConfig = useMemo(() => (
        (checklistConfigs || []).find(cfg => cfg.chunkId === uuid)
    ), [uuid, checklistConfigs]);

    return {
        checklistConfig,
        chunkIndex,
        includeVisuals,
        isActiveVersion,
        isDisabled,
        isLastOfType: isMobile ? (index === chunkCount - 1 || isTitleChunk) : (index === moduleSets.length - 1),
        isPrimary,
        isRTL,
        isTitle: isTitleChunk,
        isTranslating: isTranslating === chunkIndex,
        languageCode,
        moduleSet,
        onChange,
        onTranslate,
        opposingChunkIsEmpty: isMobile ? undefined : opposingChunkIsEmpty,
        renderAsTextArea: isTitleChunk,
        secondaryFieldSelected,
        uuid: uuid ?? "title",
        zeroBasedChunkIndex,
        onInjectNewAtEnd,
    };
}
