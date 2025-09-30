import * as React from "react";
import {
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_READER_COMMENTING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { extractBinderTitle, isSemanticallyEmptyChunk, isSemanticallyEmptyTitle } from "../../../helper";
import { useBinderLanguageComputedProps, useBinderLanguageOperations, useBinderLanguageProps } from "../../contexts/binderLanguagePropsContext";
import { useComposerComputedProps, useComposerProps } from "../../contexts/composerPropsContext";
import ChecklistStatusButton from "@binders/ui-kit/lib/elements/button/ChecklistStatusButton";
import ChunkBottomControls from "./ChunkControls/Bottom";
import { ChunkCommentsPreview } from "./Chunk/ChunkExtras/CommentsPreview/CommentsPreview";
import { ChunkDiffViewControls } from "./ChunkControls/Diff";
import { ChunkDiffViewLabels } from "./ChunkControls/DiffLabels";
import ChunkExtras from "./Chunk/ChunkExtras";
import { ChunkOperation } from "./ChunkControls/contract";
import ChunkSideControls from "./ChunkControls/Side";
import ChunkTopControls from "./ChunkControls/Top";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import cx from "classnames";
import { useActiveAccountFeatures } from "../../../../accounts/hooks";
import { useCallback } from "react";
import { useChunkProps } from "../../contexts/chunkPropsContext";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";

interface IChunkTextModuleProps {
    hideControls?: boolean;
    showDiffControls?: boolean;
    isDisabled?: boolean;
    isLoading?: boolean;
    isSelected?: boolean;
}

export const ChunkTextModule: React.FunctionComponent<IChunkTextModuleProps> = (props) => {
    const {
        hideControls,
        isDisabled,
        isLoading,
        isSelected,
        showDiffControls,
    } = props;

    const {
        checklistConfig,
        chunkIndex,
        isLastOfType,
        isRTL,
        moduleSet: {
            text: textModule,
            isEmptyAcrossLanguages,
        },
        opposingChunkIsEmpty,
        uuid,
    } = useChunkProps();

    const {
        accountUsers,
        featuresChecklists,
        isMobile,
        permissionFlags,
        setSelectedChunkDetails,
    } = useComposerProps();
    const {
        shouldRenderEmptyChunk,
        showComments,
        translatorLanguageCodes,
    } = useComposerComputedProps();

    const {
        allowMachineTranslation,
        onChunkOperation,
    } = useBinderLanguageOperations();
    const {
        binder,
        isInDiffView,
        isInTranslationView,
        isPrimary,
        languageCode,
    } = useBinderLanguageProps();
    const {
        chunkApprovals,
    } = useBinderLanguageComputedProps();

    const features = useActiveAccountFeatures();
    const commentsEnabled = features.includes(FEATURE_READER_COMMENTING) ||
        features.includes(FEATURE_COMMENTING_IN_EDITOR);
    const isTitle = chunkIndex === 0;
    const shouldUseNewTextEditor = useLaunchDarklyFlagValue<boolean>(LDFlags.USE_TIP_TAP) ?? false;
    const isEmpty = isTitle ?
        isSemanticallyEmptyTitle(extractBinderTitle(binder, languageCode)) :
        textModule && isSemanticallyEmptyChunk(textModule, { shouldUseNewTextEditor });
    const showMergeButton = !translatorLanguageCodes && chunkIndex > 1 && isSelected && !isEmptyAcrossLanguages;
    const showDeleteButton = !translatorLanguageCodes && chunkIndex > 1 && isSelected && isEmptyAcrossLanguages;
    const showAddButton = !translatorLanguageCodes && !isTitle && !isLastOfType && isSelected;
    const showMachineTranslation =
        isSelected && isInTranslationView &&
        (
            !translatorLanguageCodes ||
            (!!translatorLanguageCodes && translatorLanguageCodes.includes(languageCode))
        );

    const maybeTransformToFalseOne = useCallback(() => {
        if (isLastOfType && isEmptyAcrossLanguages && chunkIndex > 1 && shouldRenderEmptyChunk) {
            onChunkOperation(chunkIndex, ChunkOperation.delete, !isPrimary, true);
        }
    }, [shouldRenderEmptyChunk, isLastOfType, isEmptyAcrossLanguages, chunkIndex, isPrimary, onChunkOperation]);

    const wrapperClass = cx(
        "chunkNEW-text",
        {
            "right-to-left": isRTL,
            "chunkNEW-text--lastOfType": isLastOfType,
            "isActive": isSelected,
            isMobile,
        }
    );

    return (
        <div className={wrapperClass}>
            {isInDiffView && <ChunkDiffViewLabels chunkIndex={chunkIndex} />}
            {!hideControls && <ChunkTopControls
                chunkIndex={chunkIndex}
                isSecondary={!isPrimary}
                onChunkOperation={onChunkOperation}
                showDeleteButton={showDeleteButton}
                showMergeButton={showMergeButton}
            />}
            <div
                onBlur={maybeTransformToFalseOne}
                className={cx(
                    "e2eTextchunk",
                    "e2eSelectable",
                    "textchunk",
                    "selectable",
                    {
                        "is-active": isSelected,
                        "secondary-text": !isPrimary,
                        "e2eSecondary-text": !isPrimary,
                        "loading": isLoading,
                        "disabled": isDisabled,
                    })}
            >
                {props.children}
                {featuresChecklists && checklistConfig && checklistConfig.isActive && (
                    <ChecklistStatusButton disabled isInfoOnly={true} />
                )}
                {!isInDiffView && <ChunkExtras
                    binder={binder}
                    checklistConfig={checklistConfig}
                    chunkApprovals={chunkApprovals}
                    chunkId={uuid}
                    chunkIndex={chunkIndex}
                    includeChecklist={featuresChecklists && !isTitle}
                    isEmpty={isEmpty}
                    isMobile={isMobile}
                    languageCode={languageCode}
                    onChunkOperation={onChunkOperation}
                    permissionFlags={permissionFlags}
                    users={accountUsers}
                />}
                {commentsEnabled && (
                    <ChunkCommentsPreview
                        binderId={binder.id}
                        chunkCurrentPositionLog={binder.getChunkCurrentPositionLog(uuid)}
                        chunkId={uuid}
                        languageCode={languageCode}
                        selectChunk={() => setSelectedChunkDetails({
                            index: chunkIndex,
                            isPrimary: isPrimary
                        })}
                        chunkIndex={chunkIndex}
                    />
                )}
            </div>
            {!hideControls && <ChunkSideControls
                allowMachineTranslation={allowMachineTranslation}
                currentChunkEmpty={isEmpty}
                showMachineTranslation={showMachineTranslation}
                targetEmpty={isInTranslationView && opposingChunkIsEmpty}
                translatorLanguageCodes={translatorLanguageCodes}
            />}
            {!hideControls && <ChunkBottomControls
                showAddButton={showAddButton}
                showToggleNewCommentButton={isSelected && showComments}
            />}
            {showDiffControls && <ChunkDiffViewControls />}
        </div >
    );

};
