import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import React from "react";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import VisualThumbnail from "@binders/ui-kit/lib/elements/thumbnail/VisualThumbnail";

export const EditedAttachments: React.FC<{
    attachmentVisuals: Visual[],
    onRemoveAttachment: (attachmentId: string) => void,
}> = (props) => props.attachmentVisuals.length > 0 && (
    <>
        {props.attachmentVisuals.map(attachmentVisual => {
            return (
                <div
                    key={`att${attachmentVisual.id}`}
                    className="attachmentsList-thumb"
                >
                    <VisualThumbnail
                        visual={attachmentVisual}
                        bgColor={null}
                        width={32}
                        fitBehaviour={FitBehaviour.CROP}
                        isDeletable={true}
                        onDelete={() => props.onRemoveAttachment(attachmentVisual.id)}
                        maintainsOwnHoverState={true}
                        deleteActionIconName={"cancel"}
                        alwaysShowDeleteAction={true}
                    />
                </div>
            );
        })}
    </>
);