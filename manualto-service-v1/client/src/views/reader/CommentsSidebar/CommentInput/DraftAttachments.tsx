import Thumbnail, { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import Icon from "@binders/ui-kit/lib/elements/icons";
import React from "react";
import { StagedAttachment } from "../../../../stores/zustand/readerComments-store";
import cx from "classnames";

export const DraftAttachments: React.FC<{
    attachments: StagedAttachment[],
    isLoading: boolean,
    onRemoveAttachment: (clientId: string) => void,
}> = ({
    isLoading,
    onRemoveAttachment,
    attachments
}) => attachments.length > 0 && (
    <>
        {attachments.map(attachment => {
            return (
                <div
                    key={`att${attachment.clientId}`}
                    className={cx(
                        "attachmentsList-thumb",
                        { "attachmentsList-thumb--noPreview": !attachment.previewSrc }
                    )}
                >
                    <AttachmentThumbnail
                        isLoading={isLoading}
                        attachment={attachment}
                        onRemoveAttachment={onRemoveAttachment}
                    />
                </div>
            );
        })}
    </>
);

const AttachmentThumbnail: React.FC<{
    isLoading: boolean,
    attachment: StagedAttachment,
    onRemoveAttachment: (clientId: string) => void,
}> = ({
    isLoading,
    attachment,
    onRemoveAttachment,
}) => (
    <Thumbnail
        bgColor={null}
        src={attachment.previewSrc}
        width={32}
        fitBehaviour={FitBehaviour.CROP}
        isDeletable={!isLoading}
        onDelete={() => onRemoveAttachment(attachment.clientId)}
        maintainsOwnHoverState={true}
        deleteActionIconName={"cancel"}
        alwaysShowDeleteAction={true}
        centralFloatingElement={(
            <label className="attachmentsList-thumb-icon">
                <Icon name={attachment.isVideo ? "videocam" : "image"} />
            </label>
        )}
    />
);