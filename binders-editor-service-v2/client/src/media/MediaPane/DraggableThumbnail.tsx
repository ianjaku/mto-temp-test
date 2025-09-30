import * as React from "react";
import {
    MobileVisualContextModal,
    MobileVisualContextModalProps
} from "./MobileVisualContextModal";
import { VisualEditModal, VisualEditModalProps } from "../VisualEditModal/VisualEditModal";
import { useCallback, useMemo } from "react";
import { BinderMediaStoreActions } from "../binder-media-store";
import { Draggable } from "react-beautiful-dnd";
import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import VisualThumbnail from "@binders/ui-kit/lib/elements/thumbnail/VisualThumbnail";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { isVideo } from "@binders/client/lib/clients/imageservice/v1/visuals";
import {
    useBinderLanguageProps
} from "../../documents/Composer/contexts/binderLanguagePropsContext";
import { useComposerContext } from "../../documents/Composer/contexts/composerContext";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import "./MediaPane.styl";

export interface IDraggableThumbnailProps {
    chunkIndex?: number;
    className?: string;
    cloneEffect?: boolean;
    draggingDisabled?: boolean;
    hoverId?: string;
    /**
     * Instead of using the visual props, we'll default to `transparent` background,
     * `fit` behavior and `0` rotation to display in places like the media pane the
     * original visual, not the modified one
     */
    ignoreVisualSettings?: boolean;
    inDocument?: boolean;
    index: number;
    isDeletable?: boolean;
    isSelected?: boolean;
    onDelete?: (visualId) => void;
    onDetach?: (chunkIndex: number, index: number) => void;
    onNewImageAdd?: () => void;
    onSelect?: (visualId) => void;
    skipAddButton?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visual: any;
    onRetryThumbnail?: () => void;
}

const DraggableThumbnail: React.FC<IDraggableThumbnailProps> = (
    props: IDraggableThumbnailProps
) => {
    const {
        chunkIndex,
        className,
        cloneEffect,
        draggingDisabled,
        hoverId,
        ignoreVisualSettings = false,
        inDocument,
        index,
        isDeletable: isDeletableProps,
        isSelected,
        onDelete: onDeleteProps,
        onDetach,
        onNewImageAdd,
        onSelect: onSelectProps,
        skipAddButton,
        visual,
    } = props;

    const {
        id: visualId,
        bgColor,
        fitBehaviour,
        filename,
        rotation,
        isUploading,
    } = visual;

    const visualSettings = useMemo(() => {
        return ignoreVisualSettings ?
            {
                bgColor: "transparent",
                fitBehaviour: FitBehaviour.FIT,
                rotation: 0,
            } :
            {
                bgColor: bgColor && bgColor.indexOf("#") === 0 ? bgColor.slice(1) : bgColor,
                fitBehaviour: fitBehaviour === "crop" ? FitBehaviour.CROP : FitBehaviour.FIT,
                rotation,
            };
    }, [ignoreVisualSettings, bgColor, fitBehaviour, rotation]);

    const isDeletable = useMemo(
        () => (isDeletableProps !== undefined ? isDeletableProps : true),
        [isDeletableProps]
    );

    const draggableProps = useMemo(() => {
        return {
            draggableId: inDocument ?
                `in-document-${visualId},${chunkIndex},${index}` :
                `in-gallery-${visualId}`,
            key: inDocument ?
                `in-document-draggable-${visualId}-${chunkIndex}-${index}` :
                `in-gallery-draggable-${visualId}`,
        };
    }, [index, chunkIndex, inDocument, visualId]);

    const onDelete = useCallback(() => {
        if (onDeleteProps) {
            onDeleteProps(visualId);
        }
    }, [onDeleteProps, visualId]);

    const onClose = useCallback(() => {
        if (onDetach) {
            onDetach(chunkIndex, index);
        }
    }, [onDetach, chunkIndex, index]);

    const onSelect = useCallback(() => {
        if (!isSelected && onSelectProps && !inDocument) {
            onSelectProps(visualId);
        }
    }, [isSelected, onSelectProps, inDocument, visualId]);

    const width = useMemo(() => (inDocument ? 96 : 80), [inDocument]);

    const { hoveredThumbnailId, setHoveredThumbnailId, hasContext, setOpenVisual, setFocusedVisualId } = useComposerContext();
    const [localHoverState, setLocalHoverState] = React.useState(false);
    const onSetHovered = (isHovered) => {
        if (!hasContext) {
            setLocalHoverState(isHovered);
            return;
        }

        if (!isHovered) {
            setHoveredThumbnailId(null);
            return;
        }
        setHoveredThumbnailId(hoverId);
    };

    const { binder, setStateBinder } = useBinderLanguageProps();

    React.useEffect(() => {
        // visual updates do not retrigger modal re-render so we're doing it manually here
        // by setting the visual settings in the binder media store
        BinderMediaStoreActions.updateVisualSettingForVisualInChunk(chunkIndex, index, {
            rotation: visual.rotation,
            bgColor: visual.bgColor,
            fitBehaviour: visual.fitBehaviour,
            audioEnabled: visual.audioEnabled,
            autoPlay: visual.autoPlay,
            languageCodes: visual.languageCodes,
        })
    }, [chunkIndex, visual.audioEnabled, visual.autoPlay, visual.bgColor, visual.fitBehaviour, visual.languageCodes, visual.rotation, index]);

    const showEditVisualModal = useShowModal<VisualEditModalProps, unknown>(() => {
        return <VisualEditModal
            binder={binder}
            chunkIdx={chunkIndex}
            visualIdx={index}
            visual={visual}
            setStateBinder={setStateBinder}
        />;
    });

    const showMobileVisualContextModal = useShowModal<MobileVisualContextModalProps, unknown>((props) => {
        return <MobileVisualContextModal
            onClose={() => {
                props.hide();
                onClose();
            }}
            onOpenSettings={() => {
                props.hide();
                showEditVisualModal();
            }}
            onHide={props.hide}
            isVideo={isVideo(visual)}
        />;
    });

    const handleClickVisualInDocument = () => {
        if (isMobileView()) {
            showMobileVisualContextModal();
        } else {
            showEditVisualModal();
        }
    };

    const renderThumb = () => {
        return (
            <VisualThumbnail
                onRetryThumbnail={props.onRetryThumbnail}
                key={visualId}
                visual={visual}
                title={filename}
                width={width}
                fitBehaviour={visualSettings.fitBehaviour}
                bgColor={visualSettings.bgColor}
                isDeletable={isDeletable && !isUploading && !inDocument && !visual.inUse}
                isCloseable={!isUploading && inDocument}
                isSelectable={!isUploading && !inDocument}
                onDelete={onDelete}
                onClose={onClose}
                onMouseDownCapture={onSelect}
                selected={isSelected}
                visualIsUploading={isUploading}
                visualUploadedPercentage={isUploading && visual.percentUploaded}
                onClick={() => {
                    if (inDocument) {
                        handleClickVisualInDocument();
                    } else {
                        setFocusedVisualId(visualId);
                    }
                }}
                onDoubleClick={() => {
                    if (inDocument) {
                        handleClickVisualInDocument();
                    } else {
                        setOpenVisual(visual);
                    }
                }}
                onNewImageAdd={onNewImageAdd}
                rotation={visualSettings.rotation}
                skipAddButton={skipAddButton}
                isHovered={hoveredThumbnailId === hoverId || localHoverState}
                setHovered={onSetHovered}
            />
        );
    };

    // React DnD only changes the cursor once it detects movement, we want it on mouse down
    const [ isMouseDown, setIsMouseDown ] = React.useState(false);
    return (
        <div
            key={visualId}
            className={className}
            onMouseDown={() => { setIsMouseDown(true) }}
            onMouseUp={() => { setIsMouseDown(false) }}
        >
            {draggingDisabled ?
                <div className={className}>
                    <div className="thumbnail-outer-outer-wrapper">{renderThumb()}</div>
                </div> :
                <Draggable
                    key={draggableProps.key}
                    draggableId={draggableProps.draggableId}
                    index={index}
                    isDragDisabled={isUploading}
                >
                    {(provided, snapshot) => (
                        <>
                            <div className="thumbnail-dragwrapper">
                                <div
                                    className="thumbnail-outer-outer-wrapper"
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                        ...provided.draggableProps.style,
                                        cursor: isMouseDown ? "grabbing" : "grab",
                                    }}
                                >
                                    {renderThumb()}
                                </div>
                            </div>
                            <div className="thumbnail-staticplaceholder">
                                {snapshot.isDragging &&
                                    (cloneEffect ?
                                        <VisualThumbnail
                                            visual={visual}
                                            title={filename}
                                            width={width}
                                            fitBehaviour={visualSettings.fitBehaviour}
                                            skipAddButton={skipAddButton}
                                        /> :
                                        null
                                    )}
                            </div>
                        </>
                    )}
                </Draggable>
            }
        </div>
    );
};

export default DraggableThumbnail;
