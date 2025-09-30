import * as React from "react";
import Thumbnail, { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import {
    UnsupportedMedia,
    fileListToFiles,
    getAcceptVisualsString,
    isPlaceholderVisual
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { useBinderVisuals, useGetVisualTrim } from "../../../../media/binder-media-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APIEnsureScreenshotAt } from "../../../../media/api";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import DraggableThumbnail from "../../../../media/MediaPane/DraggableThumbnail";
import { Droppable } from "react-beautiful-dnd";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { IModuleImageSet } from "./types";
import { IPreviewVisual } from "../../contract";
import MinimalArrow from "@binders/ui-kit/lib/elements/icons/MinimalArrow";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UploadSquare } from "@binders/ui-kit/lib/elements/icons/UploadSquare";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import VisualThumbnail from "@binders/ui-kit/lib/elements/thumbnail/VisualThumbnail";
import cx from "classnames";
import { extendVisuals } from "../../../../media/helper";
import { useComposerContext } from "../../contexts/composerContext";
import { useFileSelector } from "../../../../media/SelectFileProvider";
import { useIsTest } from "../../../../browsing/hooks";
import { useMutation } from "@tanstack/react-query";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ChunkVisuals.styl";

interface IChunkVisualsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onVisualUpload: (chunkIndex: number, visualFiles: any[], visualIndex?: number) => void;
    previewVisuals: IPreviewVisual[];
    isDragging?: boolean;
    imagesModule?: IModuleImageSet;
    chunkIndex: number,
    thumbnailSize: number,
    onDetachVisual?: (chunkIndex: number, visualIndex: number) => void,
    isEmptyChunk?: boolean;
    className?: string;
    isTitleVisual?: boolean;
    horizontalVisuals?: "horizontal" | "vertical";
    isMobile?: boolean;
    isDisabled?: boolean;
}

function filterPlaceholders(binderVisual): boolean {
    return !binderVisual.medium || !isPlaceholderVisual(binderVisual.medium);
}

const SERIALIZABLE_FIELDS = ["id", "url", "fitBehaviour", "bgColor", "languageCodes", "rotation", "audioEnabled", "autoPlay", "startTimeMs", "endTimeMs"];
const serializeVisualForComparison = (visual: BinderVisual): string => {
    return SERIALIZABLE_FIELDS.map(field => visual[field]).join();
};

const ChunkVisuals: React.FC<IChunkVisualsProps> = ({
    chunkIndex,
    imagesModule,
    previewVisuals: previewVisualsProps,
    isDragging,
    isEmptyChunk,
    horizontalVisuals,
    className,
    thumbnailSize,
    onDetachVisual,
    isTitleVisual,
    isMobile,
    onVisualUpload,
    isDisabled
}) => {
    const { t } = useTranslation();
    const { hasHorizontalVisuals, chunkImagesBumpable } = useComposerContext();
    const isTest = useIsTest();

    const [previewVisuals, setPreviewVisuals] = useState<IPreviewVisual[]>([]);
    const prevPreviewVisualsProps = usePrevious(previewVisualsProps);
    useEffect(() => {
        const serializeVisualProps = (props?: IPreviewVisual[]) =>
            (props || []).map(v => `${v.id}${v.url}${v.isUploading}${v.percentUploaded}`).join();
        const didUpdate = serializeVisualProps(previewVisualsProps) !== serializeVisualProps(prevPreviewVisualsProps);
        if (didUpdate) {
            setPreviewVisuals(previewVisualsProps);
        }
    }, [previewVisualsProps, prevPreviewVisualsProps]);

    const [binderVisuals, setBinderVisuals] = useState<BinderVisual[] | undefined>(undefined);

    const prevImagesModule: (IModuleImageSet | undefined) = usePrevious(imagesModule);

    const getVisualTrim = useGetVisualTrim();

    useEffect(() => {
        const binderVisuals = imagesModule?.images ?? [];
        const prevBinderVisuals = prevImagesModule?.images ?? [];
        const didUpdate = (
            binderVisuals.map(serializeVisualForComparison).join() !==
            prevBinderVisuals.map(serializeVisualForComparison).join()
        );
        if (didUpdate) {
            const bv = binderVisuals.filter(filterPlaceholders);
            setBinderVisuals(bv);
        }
    }, [imagesModule, prevImagesModule]);

    const storeVisuals = useBinderVisuals();

    const binderVisualsWithTrim = useMemo(() => {
        return binderVisuals?.map((visual, visualIndex) => {
            const trim = getVisualTrim(chunkIndex, visualIndex);
            if (!trim) return visual;
            return Object.assign(Object.create(Object.getPrototypeOf(visual)), visual, trim);
        })
    }, [binderVisuals, chunkIndex, getVisualTrim]);
    
    const visuals = useMemo(() => {
        return !binderVisualsWithTrim ? [] : extendVisuals(binderVisualsWithTrim, storeVisuals as unknown as BinderVisual[]);
        
    }, [storeVisuals, binderVisualsWithTrim]);

    const [isOSDraggingOver, setIsOSDraggingOver] = useState(false);

    const previewVisualsForChunk = useMemo(() => {
        const compareVisualIndices = (v1, v2) => v1.visualIndex < v2.visualIndex ? -1 : 1;
        return previewVisuals
            .filter(v => v.positions && v.positions.some(p => p.chunkIndex === chunkIndex))
            .sort(compareVisualIndices);
    }, [previewVisuals, chunkIndex]);

    const selectFile = useFileSelector();
    const buildOnClickUploadButton = useCallback((visualIndex: number) => {
        return () => {
            if (!isTest) {
                setTimeout(() => {
                    selectFile({
                        multiple: true,
                        accept: getAcceptVisualsString(),
                    }, async (files) => {
                        try {
                            const visualFiles = await fileListToFiles(files, { includeVideos: true });
                            if (!visualFiles.length) {
                                return;
                            }
                            onVisualUpload(chunkIndex, visualFiles, visualIndex);
                        } catch (e) {
                            if (e.name === UnsupportedMedia.NAME) {
                                FlashMessages.error(e.description || e.message);
                            } else {
                                throw e;
                            }
                        }
                    });
                }, 0);
            }
        }
    }, [selectFile, chunkIndex, isTest, onVisualUpload]);

    const renderUploadButton = useCallback((visualIndex: number) => {
        return (
            <div
                className="uploadbutton transition-colors"
                key={`ut-${chunkIndex}-${visualIndex}`}
                onClick={isDisabled ? () => undefined : buildOnClickUploadButton(visualIndex)}
            >
                {!isDisabled && (
                    <UploadSquare width={thumbnailSize} height={thumbnailSize} />
                )}
            </div>
        )
    }, [buildOnClickUploadButton, thumbnailSize, isDisabled, chunkIndex]);

    const combineWithPreviewVisualsForChunk = useCallback((visualElements: React.JSX.Element[], previewVisualsForChunk: IPreviewVisual[]) => {
        return previewVisualsForChunk.reduce((reduced, previewVisual, i) => {
            const position = previewVisual.positions.find(p => p.chunkIndex === chunkIndex);
            reduced.splice(
                position.visualIndex,
                0,
                (
                    <VisualThumbnail
                        key={`prev${chunkIndex}${position.visualIndex}${i}`}
                        visual={previewVisual as unknown as Visual}
                        width={thumbnailSize}
                        fitBehaviour={FitBehaviour.FIT}
                        visualIsUploading={true}
                        visualUploadedPercentage={previewVisual.percentUploaded}
                    />
                )
            );
            return reduced;
        }, visualElements);
    }, [thumbnailSize, chunkIndex]);

    const onOSDragEnter = (e) => {
        e.preventDefault();
        setIsOSDraggingOver(true);
    }

    const onOSDragOver = (e) => {
        e.preventDefault();
    }

    const onOSDragLeave = (e) => {
        e.preventDefault();
        setIsOSDraggingOver(false);
    }

    const onOSDrop = async (e) => {
        e.preventDefault();
        setIsOSDraggingOver(false);
        try {
            const visualFiles = await fileListToFiles(e.dataTransfer && e.dataTransfer.files, { includeVideos: true });
            const images = (imagesModule?.images || []).filter(filterPlaceholders);
            if (visualFiles.length) {
                onVisualUpload(chunkIndex, visualFiles, !isEmptyChunk && images.length);
            }
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessages.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    }

    // Reason for only rendering 3 visuals max on mobile:
    // This way we don't need to set the container to overflow: auto,
    // which causes bugs with drag/drop on mobile (the drag image is sometimes not visible)
    const [visualOffset, setVisualOffset] = useState(0);
    const visualLimit = useMemo(() => isMobile ? 3 : Infinity, [isMobile]);


    const retryThumbnailMut = useMutation({
        mutationFn: async (visual: BinderVisual) => {
            if (!("startTimeMs" in visual)) return;
            if (visual.startTimeMs == null || visual.startTimeMs === 0) return;
            return APIEnsureScreenshotAt(visual.binderId, visual.id, visual.startTimeMs);
        },
    });

    const renderNoVisualsView = React.useCallback(() => {
        if (isDragging) {
            return [
                <Thumbnail
                    key={`dropzone${chunkIndex}`}
                    bgColor={null}
                    className="chunk-images-dropzone"
                    src={null}
                    width={thumbnailSize}
                    fitBehaviour={FitBehaviour.CROP}
                />
            ];
        }
        if (!(previewVisualsForChunk?.length)) {
            return [renderUploadButton(0)];
        }
        return [];
    }, [chunkIndex, isDragging, previewVisualsForChunk?.length, renderUploadButton, thumbnailSize]);

    const renderVisualsView = React.useCallback(() => {
        const visualElements = visuals.map((visual, visualIndex) => {
            return (
                <DraggableThumbnail
                    onRetryThumbnail={() => retryThumbnailMut.mutate(visual)}
                    key={`${visual.id}-${visualIndex}`}
                    visual={visual}
                    inDocument
                    className={cx(
                        "chunk-images-thumbnail",
                        { secondary: visualIndex > 0 }
                    )}
                    index={visualIndex}
                    chunkIndex={chunkIndex}
                    onDetach={onDetachVisual}
                    onNewImageAdd={buildOnClickUploadButton(visualIndex + 1)}
                    skipAddButton={hasHorizontalVisuals}
                    hoverId={`chunk-${visual.id}$-${chunkIndex}-${visualIndex}`}
                />
            )
        });

        if (isDragging) {
            visualElements.push((
                <div key="blank" className="thumbnail-whitespace" />
            ));
        } else {
            const skipUploadButton = isTitleVisual || (!!visuals.length && !hasHorizontalVisuals);
            if (!skipUploadButton) {
                visualElements.push(renderUploadButton(visuals.length));
            }
        }

        return visualElements;
    }, [buildOnClickUploadButton, chunkIndex, hasHorizontalVisuals, isDragging, isTitleVisual, onDetachVisual, renderUploadButton, visuals, retryThumbnailMut]);

    const renderVisualElements = React.useCallback(() => {
        let visualElements = !visuals || visuals.length === 0 ?
            renderNoVisualsView() :
            renderVisualsView();
        if (previewVisualsForChunk) {
            visualElements = combineWithPreviewVisualsForChunk(visualElements, previewVisualsForChunk);
        }

        const visualElementsToRender = visualElements.slice(visualOffset, visualLimit + visualOffset);

        if (visualElements.length > visualLimit + visualOffset) {
            visualElementsToRender.push((
                <div
                    key="more"
                    className="chunk-images-arrow"
                    onClick={() => setVisualOffset(Math.min(visualElements.length - visualLimit, visualOffset + visualLimit))}
                >
                    <MinimalArrow />
                </div>
            ));
        }
        if (visualOffset > 0) {
            visualElementsToRender.unshift((
                <div
                    key="less"
                    className="chunk-images-arrow"
                    onClick={() => setVisualOffset(Math.max(0, visualOffset - visualLimit))}
                >
                    <MinimalArrow direction="left" />
                </div>
            ));
        }
        return visualElementsToRender;
    }, [visuals, visualOffset, visualLimit, renderNoVisualsView, renderVisualsView, combineWithPreviewVisualsForChunk, previewVisualsForChunk]);

    const renderOSDropZone = () => {
        return (
            <div
                className="chunk-images-dropfilesarea"
                onDragOver={onOSDragOver}
                onDragLeave={onOSDragLeave}
                onDrop={onOSDrop}
                style={{ width: thumbnailSize }}
            >
                <span className="media-pane-dropfilesarea-label">
                    {t(TK.General_Upload)}
                </span>
            </div>
        );
    }

    const hasVisuals = useMemo(() => imagesModule && imagesModule.images && imagesModule.images.length, [imagesModule]);
    const droppableId = useMemo(
        () => isTitleVisual ? "document-thumbnail-droppable" : `chunk-images-droppable-${isEmptyChunk ? "empty" : chunkIndex}`,
        [chunkIndex, isTitleVisual, isEmptyChunk]
    );

    return (
        <Droppable
            droppableId={droppableId}
            type="visual"
            direction={horizontalVisuals}
            isDropDisabled={isDisabled}
        >
            {(provided, snapshot) => (
                <div
                    className={cx(
                        "chunk-images",
                        className,
                        { "chunk-images-isDragging": isDragging },
                        { "chunk-images-snapshotIsDraggingOver": snapshot.isDraggingOver },
                    )}
                    ref={provided.innerRef}
                    onDragEnter={onOSDragEnter}
                    {...provided.droppableProps}
                    key={`chunk-images-v${chunkImagesBumpable}`} // rerender after visual drop; fixes a bug on iOS where drag/drop a visual onto the same chunk resulted in the upload button and visual rendering on top of each other afterwards
                >
                    {isOSDraggingOver && renderOSDropZone()}
                    {renderVisualElements()}
                    <div
                        style={{ display: isTitleVisual ? "none" : "block" }}
                        className={cx("chunk-images-placeholderWrapper")}
                    >
                        {hasVisuals ? provided.placeholder : null}
                    </div>
                </div>
            )}
        </Droppable>
    );
}

export default ChunkVisuals;
