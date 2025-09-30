import Thumbnail, { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import {
    UploadingAttachment,
    useCommentUploadingAttachments,
} from "../../../../stores/zustand/readerComments-store";
import { Image } from "@binders/client/lib/clients/imageservice/v1/contract";
import React from "react";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualModal } from "../../VisualModal";
import VisualThumbnail from "@binders/ui-kit/lib/elements/thumbnail/VisualThumbnail";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";

export const CommentAttachments: React.FC<{
    feedbackAttachments: Image[];
    commentId: string;
}> = ({
    feedbackAttachments,
    commentId
}) => {
    const uploadingAttachmentsForComment = useCommentUploadingAttachments(commentId);
    const feedbackAttachmentsFilenames = new Set(feedbackAttachments.map(a => a.filename));
    // On a reader comments refresh, the 100% uploaded images will already be available as
    // regular feedbackAttachments, so we need to filter them out from also being displayed as in progress
    const uploadingAttachments = uploadingAttachmentsForComment.filter(attachment =>
        !feedbackAttachmentsFilenames.has(trimExtension(attachment.name)));
    return (
        <div className="comment-attachments">
            {feedbackAttachments.map((image) => (
                <UploadedVisual key={`att${image.id}`} image={image} />
            ))}
            {uploadingAttachments.map((attachment, idx) => (
                <UploadingVisual key={`att${attachment.name}${idx}`} attachment={attachment} />
            ))}
        </div>
    );
}

const UploadingVisual: React.FC<{ attachment: UploadingAttachment }> = ({ attachment }) => (
    <Thumbnail
        bgColor={null}
        src={attachment.previewSrc}
        width={32}
        fitBehaviour={FitBehaviour.CROP}
        maintainsOwnHoverState={true}
        visualIsUploading={true}
        visualUploadedPercentage={attachment.percentUploaded}
    />
);

const UploadedVisual: React.FC<{ image: Image }> = ({ image }) => {
    const showVisualModal = useShowModal(VisualModal);
    const visual = Object.assign(Object.create(Visual.prototype), image);
    return (
        <VisualThumbnail
            visual={image}
            width={32}
            fitBehaviour={FitBehaviour.CROP}
            onClick={() => showVisualModal({ visual })}
        />
    );
}

const trimExtension = (fileName: string) =>
    fileName.includes(".") ?
        fileName.slice(0, fileName.lastIndexOf(".")) :
        fileName
