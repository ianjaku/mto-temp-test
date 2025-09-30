import * as React from "react";
import { ChunkLoadingState, useChunkState } from "../../../contexts/chunkStateContext";
import {
    useBinderLanguageComputedProps,
    useBinderLanguageOperations,
    useBinderLanguageProps
} from "../../../contexts/binderLanguagePropsContext";
import {
    useComposerComputedProps,
    useComposerProps
} from "../../../contexts/composerPropsContext";
import AutoBareTextarea from "../../AutoBareTextArea";
import { ChunkTextModule } from "../ChunkTextModule";
import ChunkVisuals from "../ChunkVisuals";
import { ComposerContext } from "../../../contexts/composerContext";
import { EditorState } from "draft-js";
import { FEATURE_EMOJIS_IN_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TextEditor from "@binders/ui-kit/lib/elements/text-editor";
import { TextEditor as TextEditorNew } from "../TextEditor";
import cx from "classnames";
import { useBinderDiff } from "../../../../../content/BinderDiffProvider";
import { useChunkProps } from "../../../contexts/chunkPropsContext";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./Chunk.styl";

const { useCallback, useMemo } = React;

export const THUMBNAIL_SIZE = 96;

export interface SelectedChunkDetails {
    index: number,
    isPrimary: boolean,
    version?: number,
}

const Chunk: React.FC<{
    className?: string;
}> = props => {
    const { className } = props;

    const {
        chunkIndex,
        includeVisuals,
        isActiveVersion,
        isDisabled,
        isLastOfType,
        isPrimary,
        isRTL,
        isTitle,
        languageCode,
        moduleSet,
        onBlur,
        onChange,
        renderAsTextArea,
        zeroBasedChunkIndex,
        onInjectNewAtEnd,
    } = useChunkProps();

    const { translatorLanguageCodes } = useComposerComputedProps();
    const {
        accountFeatures,
        accountUsers,
        draggingInfo,
        previewVisuals,
        setSelectedChunkDetails,
    } = useComposerProps();

    const {
        binder,
        isInDiffView,
        isInTranslationView,
    } = useBinderLanguageProps();

    const {
        onDetachVisual,
        onVisualUpload,
    } = useBinderLanguageOperations();
    const {
        horizontalVisuals,
        langIdx,
    } = useBinderLanguageComputedProps();

    const { binderDiffStateMap } = useBinderDiff();

    const {
        text: textModule,
        image: imagesModule,
    } = moduleSet;

    const { t }: { t: TFunction } = useTranslation();

    const { chunkState } = useChunkState(chunkIndex);

    const onChunkFocus = useCallback((_, index, isPrimaryOverride?: boolean) => {
        setSelectedChunkDetails({ index: parseInt(index, 10), isPrimary: isPrimaryOverride ?? isPrimary });
    }, [setSelectedChunkDetails, isPrimary]);

    const isDragging = useMemo(() => draggingInfo && draggingInfo.isDragging, [draggingInfo]);

    const metaKey = useMemo(() => textModule && textModule.meta && textModule.meta.key, [textModule]);

    /**
     * @deprecated (draft.js)
     */
    const handleRichTextChange = useCallback(({ state }: { state: EditorState }) => {
        onChange(state, undefined, undefined, metaKey, zeroBasedChunkIndex);
    }, [onChange, metaKey, zeroBasedChunkIndex]);

    // tiptap
    const handleTextEditorChange = useCallback((json: string, html: string) => {
        onChange(undefined, json, html, metaKey, zeroBasedChunkIndex);
    }, [onChange, metaKey, zeroBasedChunkIndex]);

    const handleTextChange = useCallback((text: string, languageCode: string) => {
        onChange(text, undefined, undefined, languageCode, undefined);
    }, [onChange]);

    const featuresEmoji = useMemo(() => accountFeatures.includes(FEATURE_EMOJIS_IN_EDITOR), [accountFeatures]);

    const shouldUseNewTextEditor = useLaunchDarklyFlagValue(LDFlags.USE_TIP_TAP) ?? false;

    const handleVerticalTabNavigation = useCallback((options = { isBackwd: false, isPrimary: undefined }) => {
        if (isLastOfType && !options.isBackwd) {
            onInjectNewAtEnd();
            return;
        }
        onChunkFocus(undefined, chunkIndex + (options.isBackwd ? -1 : 1), options.isPrimary);
    }, [chunkIndex, isLastOfType, onChunkFocus, onInjectNewAtEnd]);

    const handleTabNavigation = useCallback((options = { isBackwd: false }) => {
        if (isInTranslationView) {
            if (isPrimary && !options.isBackwd) {
                setSelectedChunkDetails({ index: chunkIndex, isPrimary: false });
            } else if (isPrimary && options.isBackwd) {
                handleVerticalTabNavigation({ ...options, isPrimary: false });
            } else if (!isPrimary && !options.isBackwd) {
                handleVerticalTabNavigation({ ...options, isPrimary: true });
            } else if (!isPrimary && options.isBackwd) {
                setSelectedChunkDetails({ index: chunkIndex, isPrimary: true });
            }
            return;
        }
        handleVerticalTabNavigation(options);
    }, [chunkIndex, handleVerticalTabNavigation, isInTranslationView, isPrimary, setSelectedChunkDetails]);

    const renderEditor = () => {
        if (renderAsTextArea) {
            return (
                <AutoBareTextarea
                    className=""
                    disabled={isDisabled}
                    editorStateVersion={binder.getContentVersion()}
                    index={0}
                    languageCode={languageCode}
                    onBlur={onBlur}
                    onChange={handleTextChange}
                    onFocus={onChunkFocus}
                    placeholder={t(TK.Edit_TitlePrompt)}
                    style={{ height: "96px", maxHeight: "96px" }}
                    text={textModule.data?.[0]}
                    {...(!shouldUseNewTextEditor ? { tabIndex: 1 } : {})}
                    handleTabNavigation={handleTabNavigation}
                    isPrimary={isPrimary}
                />
            );
        } else {
            const shouldRenderChunkFooter = isInDiffView && isPrimary || !isInDiffView;
            const isEditingDisabled = isInDiffView || isDisabled || chunkState.isReadOnly;
            return <ComposerContext.Consumer>
                {context => (
                    shouldUseNewTextEditor ?
                        (<>
                            <TextEditorNew
                                isFocused={!!isActiveVersion}
                                onFocus={(e) => onChunkFocus(e, chunkIndex)}
                                textModule={textModule}
                                onChange={handleTextEditorChange}
                                handleTabNavigation={handleTabNavigation}
                            />
                            {shouldRenderChunkFooter && <div className="chunkNEW-footerNumber">{chunkIndex}</div>}
                        </>) :
                        (<>
                            <TextEditor
                                accountUsers={accountUsers}
                                className={cx({
                                    "secondary-text": !isPrimary,
                                    "is-active": !!isActiveVersion,
                                })}
                                disabled={isEditingDisabled}
                                editorState={textModule.state}
                                editorStateVersion={binder.getContentVersion()}
                                enableEmoji={featuresEmoji}
                                index={chunkIndex}
                                isActiveVersion={isActiveVersion}
                                metaKey={metaKey}
                                onChange={handleRichTextChange}
                                onFocus={onChunkFocus}
                                setDisableChunkPointerEvents={context.setDisableChunkPointerEvents}
                                tabIndex={chunkIndex + 1}
                                textAlignment={isRTL ? "right" : "left"}
                                zeroBasedIndex={zeroBasedChunkIndex}
                            />
                            {shouldRenderChunkFooter && <div className="chunkNEW-footerNumber">{chunkIndex}</div>}
                        </>)
                )
                }
            </ComposerContext.Consumer>;
        }
    };

    const isDiffHidden = binderDiffStateMap[langIdx]?.[chunkIndex] === "NoDiff_Original" ||
        binderDiffStateMap[langIdx]?.[chunkIndex] === "NoDiff_Changed";

    return (
        <div
            className={cx(
                "chunkNEW",
                className,
                {
                    "chunkNEW--lastOfType": isLastOfType,
                    "chunkNEW-disabled": isDisabled,
                    "chunkNEW-translateMode": !!translatorLanguageCodes,
                },
            )}
        >
            {includeVisuals && (
                <ChunkVisuals
                    chunkIndex={chunkIndex}
                    className="chunkNEW-visuals"
                    horizontalVisuals={horizontalVisuals}
                    imagesModule={imagesModule}
                    isDisabled={!!translatorLanguageCodes || isDisabled}
                    isDragging={isDragging}
                    isTitleVisual={isTitle}
                    onDetachVisual={onDetachVisual}
                    onVisualUpload={onVisualUpload}
                    previewVisuals={previewVisuals}
                    thumbnailSize={THUMBNAIL_SIZE}
                />
            )}
            <ChunkTextModule
                hideControls={isInDiffView}
                isDisabled={isDisabled || chunkState.isReadOnly}
                isLoading={chunkState.isReadOnly || chunkState.loadingState === ChunkLoadingState.Loading}
                isSelected={!!isActiveVersion}
                showDiffControls={isDiffHidden && isInDiffView || isInDiffView && !isDiffHidden && !isPrimary}
            >
                {renderEditor()}
            </ChunkTextModule>
        </div>
    );
};

export default Chunk;
