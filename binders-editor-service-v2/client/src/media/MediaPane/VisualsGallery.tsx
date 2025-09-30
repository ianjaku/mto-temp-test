import * as React from "react";
import { Droppable, DroppableProvided } from "react-beautiful-dnd";
import DraggableThumbnail from "./DraggableThumbnail";
import { IPreviewVisual } from "../../documents/Composer/contract";
import { MediaPaneUsage } from ".";
import { StoreVisual } from "../binder-media-store";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

type VisualGalleryProps = {
    onClickUploadVisual: () => void,
    onDeleteVisual: (visualId: string) => void,
    onSelectVisual: (visualId: string) => void,
    provided?: DroppableProvided,
    selectedVisualId: string,
    visuals: (IPreviewVisual | StoreVisual)[],
    usage: MediaPaneUsage,
};
const VisualsGallery: React.FC<VisualGalleryProps> = ({
    usage,
    onClickUploadVisual,
    onDeleteVisual,
    onSelectVisual,
    provided,
    selectedVisualId,
    visuals,
}) => {
    const { t } = useTranslation();
    return (
        <div className="binder-visuals-gallery" ref={provided && provided.innerRef} {...(provided || {}).droppableProps} style={{}}>
            {/* We need to set the width explicitly on the <img> below or IE will stretch the SVG */}
            <div className="binder-visuals-gallery-upload-button" onClick={onClickUploadVisual}>
                <img className="binder-visuals-gallery-upload-button-svg" src="/assets/upload-square-white.svg" width="96px" alt={t(TK.Visual_UploadNewVisual)} />
            </div>
            {visuals.map((visual, index) => (
                <DraggableThumbnail
                    key={visual.id}
                    visual={visual}
                    className="binder-visuals-gallery-image"
                    index={index}
                    cloneEffect={true}
                    onSelect={onSelectVisual}
                    onDelete={onDeleteVisual}
                    isSelected={selectedVisualId === visual.id}
                    draggingDisabled={usage === MediaPaneUsage.CollectionEdit}
                    hoverId={`mediapane-${visual.id}`}
                    ignoreVisualSettings
                />
            ))}
            {provided && provided.placeholder}
        </div>
    );
}

const DroppableVisualsGallery: React.FC<VisualGalleryProps> = (props) => {
    return props.usage === MediaPaneUsage.CollectionEdit ?
        <VisualsGallery {...props} /> :
        <Droppable droppableId="binder-visuals-gallery-droppable" isDropDisabled={true} type="visual">
            {provided => <VisualsGallery {...props} provided={provided}/>}
        </Droppable>
}

export default DroppableVisualsGallery;