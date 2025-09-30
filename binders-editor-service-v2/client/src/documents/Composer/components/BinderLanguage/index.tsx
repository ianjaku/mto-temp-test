import * as React from "react";
import { CSSProperties, FC, useCallback, useEffect, useMemo } from "react";
import { Draggable, DraggableProvided, DraggableStateSnapshot } from "react-beautiful-dnd";
import { useBinderLanguageComputedProps, useBinderLanguageProps } from "../../contexts/binderLanguagePropsContext";
import { useComposerComputedProps, useComposerProps } from "../../contexts/composerPropsContext";
import { ApprovedStatus } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderDiffViewControls } from "./BinderDiffViewControls";
import BinderLanguageControls from "./BinderLanguageControls/BinderLanguageControls";
import { ChunkPropsContextProvider } from "../../contexts/chunkPropsContext";
import DragButton from "../DragButton";
import { FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import FalseChunk from "./FalseChunk";
import { IModuleSet } from "./types";
import { KEY_BINDER_IS_SAVING } from "../../../store";
import { ResponsiveChunk } from "./ResponsiveChunk";
import { THUMBNAIL_SIZE } from "./Chunk";
import { buildDocumentInfo } from "../../helpers/binder";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { injectChunk } from "../../helpers/binderUpdates";
import { onUploadVisualFiles } from "../../helpers/upload";
import { useBinderDiff } from "../../../../content/BinderDiffProvider";
import { useChunkApprovalContext } from "../../contexts/chunkApprovalsContext";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import useReselectActiveChunkOnNewBinder from "./hooks/useReselectActiveChunkOnNewBinder";
import { useVisualPasteListener } from "./hooks/useVisualPasteListener";
import "./BinderLanguage.styl";

export const BinderLanguage: FC<{ className?: string; }> = props => {

    const { className } = props;

    const {
        binder,
        includeVisuals,
        isInDiffView,
        isInTranslationView,
        isPrimary,
        languageCode,
        readonlyMode = false,
    } = useBinderLanguageProps();

    const {
        accountFeatures,
        domain,
        draggingInfo,
        onBinderUpdate,
        previewVisuals,
        selectedChunkDetails,
        setSelectedChunkDetails,
    } = useComposerProps();

    const {
        shouldRenderEmptyChunk,
        translatorLanguageCodes,
    } = useComposerComputedProps();

    const {
        accountId,
        chunkApprovals,
        chunkCount,
        hasHorizontalVisuals,
        isTitleVisualMirroringMode,
        langIdx,
        moduleSets,
    } = useBinderLanguageComputedProps();

    const { binderDiffStateMap } = useBinderDiff();

    const documentInfo = useMemo(() => buildDocumentInfo(binder, languageCode), [binder, languageCode]);

    useReselectActiveChunkOnNewBinder(binder, usePrevious(binder), selectedChunkDetails, setSelectedChunkDetails);

    // Prevents the user from make changes to the binder while the empty chunk is updating
    useEffect(() => {
        const preventTabIfEmptyChunkUpdating = (e) => {
            const TAB_KEY_CODE = 9;
            if (e.keyCode === TAB_KEY_CODE && chunkCount === selectedChunkDetails.index && !shouldRenderEmptyChunk) {
                e.preventDefault();
                return;
            }
        };
        document.addEventListener("keydown", preventTabIfEmptyChunkUpdating);

        // Returning a function works just like componentWillUnmount
        return () => document.removeEventListener("keydown", preventTabIfEmptyChunkUpdating);
    }, [chunkCount, selectedChunkDetails, shouldRenderEmptyChunk]);

    const { isLanguageApproved } = useChunkApprovalContext();
    const featuresApprovalFlow = accountFeatures.includes(FEATURE_APPROVAL_FLOW);
    const allChunksApproved = !featuresApprovalFlow ? true : isLanguageApproved(languageCode);

    const validChunkIds = useMemo(() => new Set(moduleSets.map(ms => ms.uuid)), [moduleSets]);
    const approvedChunksCount = useMemo(() => chunkApprovals.filter(ap =>
        (validChunkIds.has(ap.chunkId) || ap.chunkId === binder.id) &&
        ap.approved === ApprovedStatus.APPROVED &&
        ap.chunkLanguageCode === languageCode
    ).length, [binder.id, chunkApprovals, languageCode, validChunkIds])

    const unapprovedChunksCount = chunkCount - approvedChunksCount + 1 // +1 because of title;

    const transformFalseChunkToRealOne = useCallback(() => {
        const binderUpdate = injectChunk(chunkCount - 1, chunkCount, !isPrimary);
        binderUpdate.updateBinderOptions.isEmptyChunk = true;
        onBinderUpdate(binderUpdate);
    }, [chunkCount, isPrimary, onBinderUpdate]);

    const onVisualUpload = useCallback(async (
        chunkIndex: number,
        visualFiles: File[],
        visualIndex?: number,
        bypassNewChunk = false,
    ) => {
        dispatch({
            type: KEY_BINDER_IS_SAVING,
        });
        const positions = [{ chunkIndex, visualIndex }];
        if (chunkIndex === 0 && isTitleVisualMirroringMode) {
            positions.push({ chunkIndex: 1, visualIndex: 0 });
        }
        const updateNewChunk = !bypassNewChunk ? (chunkIndex > chunkCount) : false;
        const patch = await onUploadVisualFiles(binder, visualFiles, positions, chunkCount, accountId, updateNewChunk);
        if (patch) {
            onBinderUpdate({
                patches: [() => patch],
                updateBinderOptions: {
                    bumpContentVersion: true,
                    affectsVisuals: true,
                    proposedApprovalResetChunks: [chunkIndex - 1],
                },
            });
        }
    }, [binder, chunkCount, onBinderUpdate, isTitleVisualMirroringMode, accountId]);

    useVisualPasteListener(selectedChunkDetails?.index, onVisualUpload);

    const onVisualUploadToFakeChunk = useCallback(
        async (chunkIndex: number, visualFiles: File[], visualIndex?: number) => {
            transformFalseChunkToRealOne();
            onVisualUpload(chunkIndex, visualFiles, visualIndex, true);
        },
        [onVisualUpload, transformFalseChunkToRealOne],
    );

    const gridRowForChunkIndex = useCallback((chunkIndex: number) => {
        const offset = draggingInfo.chunkIndexOfDraggingChunk !== undefined && chunkIndex >= draggingInfo.chunkIndexOfDraggingChunk ? 2 : 3;
        return chunkIndex + offset;
    }, [draggingInfo.chunkIndexOfDraggingChunk]);

    const renderDragButton = useCallback((isPrimary: boolean, provided: DraggableProvided, isDragging: boolean, i: number) => {
        const onlyPrimaryLanguageVisible = !isInTranslationView;
        const bothLanguagesVisibileAndSecondaryRenderedNow = !isPrimary;
        return (onlyPrimaryLanguageVisible || bothLanguagesVisibileAndSecondaryRenderedNow) && (
            <DragButton
                dragHandleProps={provided.dragHandleProps}
                isActive={selectedChunkDetails.index === (i + 1)}
                isDragging={isDragging}
                key={`drag-chunk-${i}`}
                style={{ ...(hasHorizontalVisuals ? { top: THUMBNAIL_SIZE } : {}) }}
            />
        );
    }, [hasHorizontalVisuals, selectedChunkDetails, isInTranslationView]);

    const renderChunk = (
        moduleSet: IModuleSet,
        index: number,
        options: {
            className: string,
            style: CSSProperties,
        }) => {
        const draggableId = `chunk-${(index)}`;
        const key = `${draggableId}-${moduleSet.uuid}`;
        const styleObj = {
            ...options.style,
            marginTop: hasHorizontalVisuals && !isPrimary ? "96px" : undefined,
            marginBottom: hasHorizontalVisuals && !isPrimary ? "1.5em" : undefined,
        }
        if (isInDiffView) {
            return (
                <div
                    key={key}
                    style={styleObj}
                    className={`chunk-dragwrapper ${options.className} chunk-${index + 1} ${isPrimary ? "isPrimary" : "isSecondary"}`}
                >
                    <ChunkPropsContextProvider props={{ index }}>
                        <ResponsiveChunk className={className} />
                    </ChunkPropsContextProvider>
                </div>
            );
        }
        return (
            <Draggable
                draggableId={draggableId}
                index={index}
                key={key}
                isDragDisabled={!!translatorLanguageCodes}
            >
                {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
                    return (
                        <div
                            {...((provided && provided.draggableProps) || {})}
                            style={{
                                ...styleObj,
                                ...(provided && provided.draggableProps && provided.draggableProps.style) || {},
                                opacity: snapshot.isDragging ? 0.8 : 1.0,
                            }}
                            ref={provided.innerRef}
                            className={`chunk-dragwrapper ${options.className} ${isPrimary ? "isPrimary" : "isSecondary"}`}
                        >
                            <ChunkPropsContextProvider props={{ index }}>
                                <ResponsiveChunk className={className} />
                            </ChunkPropsContextProvider>
                            {!translatorLanguageCodes && renderDragButton(isPrimary, provided, snapshot.isDragging, index)}
                        </div>
                    )
                }}
            </Draggable>
        )
    }

    return (
        <>
            {moduleSets.map((moduleSet, idx) => {
                const gridRow = gridRowForChunkIndex(idx);
                const chunkIdx = idx + 1
                const isDiffHidden = binderDiffStateMap[langIdx]?.[chunkIdx] === "NoDiff_Original" ||
                    binderDiffStateMap[langIdx]?.[chunkIdx] === "NoDiff_Changed";
                const shouldRenderChunk = !isInDiffView || (isInDiffView && (isPrimary || !isPrimary && !isDiffHidden));

                if (!shouldRenderChunk) return null;
                const chunkStyle: CSSProperties = { gridRow };
                if (isInDiffView && isDiffHidden) {
                    chunkStyle.gridColumnStart = 1
                    chunkStyle.gridColumnEnd = 3
                } else {
                    chunkStyle.gridColumn = isPrimary ? 1 : 2;
                }
                return renderChunk(moduleSet, idx, {
                    className: "",
                    style: chunkStyle,
                })
            })}
            {!isInDiffView && (
                <FalseChunk
                    gridColumn={isPrimary ? 1 : 2}
                    gridRow={chunkCount + 3}
                    includeVisuals={includeVisuals}
                    isDisabled={readonlyMode || (translatorLanguageCodes && translatorLanguageCodes.includes(languageCode))}
                    isDragging={draggingInfo.isDragging}
                    marginTop={hasHorizontalVisuals && !isPrimary ? "96px" : undefined}
                    newIndex={chunkCount + 1}
                    onVisualUpload={onVisualUploadToFakeChunk}
                    previewVisuals={previewVisuals}
                    transformFalseChunkToRealOne={transformFalseChunkToRealOne}
                />
            )}
            {!isInDiffView && <BinderLanguageControls
                allChunksApproved={allChunksApproved}
                documentInfo={documentInfo}
                gridColumn={isPrimary ? 1 : 2}
                gridRow={chunkCount + 4}
                isReadonlyMode={readonlyMode}
                languageCode={languageCode}
                readerLocation={getReaderLocation(domain)}
                unapprovedChunksCount={unapprovedChunksCount}
            />}
            {isInDiffView && !isPrimary && <BinderDiffViewControls
                gridColumn={isPrimary ? 1 : 2}
                gridRow={chunkCount + 4}
            />}
        </>
    );

}
