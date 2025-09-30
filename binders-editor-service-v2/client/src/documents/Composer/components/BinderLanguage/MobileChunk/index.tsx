import * as React from "react";
import { ChunkLoadingState, useChunkState } from "../../../contexts/chunkStateContext";
import { FC, useCallback, useMemo } from "react";
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
import { EditorState } from "draft-js";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TextEditor from "@binders/ui-kit/lib/elements/text-editor";
import { TextEditor as TextEditorNew } from "../TextEditor";
import cx from "classnames";
import { isLanguageRTL } from "@binders/client/lib/languages/helper";
import { useChunkProps } from "../../../contexts/chunkPropsContext";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "../Chunk/Chunk.styl";

const THUMBNAIL_SIZE = 96;

interface IChunkProps {
    className?: string;
    onClick?: () => void;
}

const MobileChunk: FC<IChunkProps> = (props: IChunkProps) => {
    const { className, onClick } = props;

    const {
        chunkIndex,
        includeVisuals,
        isActiveVersion,
        isDisabled,
        isPrimary,
        isTitle,
        languageCode,
        moduleSet,
        onChange,
        renderAsTextArea,
    } = useChunkProps();

    const {
        draggingInfo,
        previewVisuals,
        selectedChunkDetails,
        setSelectedChunkDetails,
    } = useComposerProps();
    const { translatorLanguageCodes } = useComposerComputedProps();

    const { binder } = useBinderLanguageProps();

    const {
        onDetachVisual,
        onVisualUpload,
    } = useBinderLanguageOperations();
    const {
        horizontalVisuals,
    } = useBinderLanguageComputedProps()

    const {
        text: textModule,
        image: imagesModule,
    } = moduleSet;

    const isRTL = languageCode ? isLanguageRTL(languageCode) : false;
    const zeroBasedChunkIndex = useMemo(() => chunkIndex - 1, [chunkIndex]);

    const { chunkState } = useChunkState(chunkIndex);

    const onChunkFocus = useCallback((_, index) => {
        setSelectedChunkDetails({ index: parseInt(index, 10), isPrimary });
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

    const { t }: { t: TFunction } = useTranslation();

    // for now we disable emojis in mobile views
    // const featuresEmoji = useMemo(() => accountFeatures.includes(FEATURE_EMOJIS_IN_EDITOR), [accountFeatures]);
    const shouldUseNewTextEditor = useLaunchDarklyFlagValue(LDFlags.USE_TIP_TAP) ?? false;

    const renderEditor = () => {
        if (renderAsTextArea) {
            return <AutoBareTextarea
                editorStateVersion={binder.getContentVersion()}
                index={0}
                languageCode={languageCode}
                onChange={handleTextChange}
                onFocus={onChunkFocus}
                placeholder={t(TK.Edit_TitlePrompt)}
                style={{ height: "96px", maxHeight: "96px" }}
                tabIndex={1}
                text={textModule.data[0]}
                isPrimary={isPrimary}
            />;
        } else {
            return shouldUseNewTextEditor ?
                <>
                    <TextEditorNew
                        isFocused={chunkIndex === selectedChunkDetails?.index}
                        onFocus={(e) => onChunkFocus(e, chunkIndex)}
                        textModule={textModule}
                        onChange={handleTextEditorChange}
                    />
                    <div className="chunkNEW-footerNumber">{chunkIndex}</div>
                </> :
                <>
                    <TextEditor
                        className={cx({ "secondary-text": !isPrimary })}
                        disabled={isDisabled || chunkState.isReadOnly}
                        editorState={textModule.state}
                        editorStateVersion={binder.getContentVersion()}
                        enableEmoji={false}
                        index={chunkIndex}
                        isActiveVersion={isActiveVersion}
                        metaKey={textModule.meta.key}
                        onChange={handleRichTextChange}
                        onFocus={onChunkFocus}
                        setDisableChunkPointerEvents={() => { /**/ }}
                        textAlignment={isRTL ? "right" : "left"}
                        zeroBasedIndex={zeroBasedChunkIndex}
                    />
                    <div className="chunkNEW-footerNumber">{chunkIndex}</div>
                </>;
        }
    };

    return (
        <div
            className={cx(
                "chunkNEW",
                className,
                {
                    "chunkNEW-disabled": isDisabled,
                    "chunkNEW-translateMode": !!translatorLanguageCodes,
                })
            }
            onClick={isDisabled ? () => undefined : onClick}
        >
            {includeVisuals && (
                <ChunkVisuals
                    isDragging={isDragging}
                    imagesModule={imagesModule}
                    chunkIndex={chunkIndex}
                    previewVisuals={previewVisuals}
                    thumbnailSize={THUMBNAIL_SIZE}
                    onDetachVisual={onDetachVisual}
                    onVisualUpload={onVisualUpload}
                    className="chunkNEW-visuals"
                    isTitleVisual={isTitle}
                    horizontalVisuals={horizontalVisuals}
                    isMobile={true}
                    isDisabled={!!translatorLanguageCodes || isDisabled}
                />
            )}
            <ChunkTextModule
                isDisabled={isDisabled || chunkState.isReadOnly}
                isLoading={chunkState.isReadOnly || chunkState.loadingState === ChunkLoadingState.Loading}
                isSelected={!!isActiveVersion}
            >
                {renderEditor()}
            </ChunkTextModule>
        </div>
    );
};

export default MobileChunk;
