import React, { useCallback, useRef } from "react";
import {
    UnsupportedMedia,
    fileListToFiles,
    getAcceptVideosString
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { useGenerateDocument, useRedirectWhenGenerated, useUploadVideo } from "./hooks";
import Button from "@binders/ui-kit/lib/elements/button";
import { COMPOSER_ROUTE } from "../documents/Composer/routes";
import { FlashMessages } from "../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import { ProgressBar } from "./ProgressBar";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useHistory } from "react-router";
import { useParams } from "react-router";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ManualFromVideo.styl";

export enum ManualFromVideoState {
    Upload = "upload",
    Uploading = "uploading",
    Uploaded = "uploaded",
    Generating = "generating",
    Generated = "generated",
}

export const ManualFromVideo: React.FC = () => {
    const { collectionId } = useParams<{collectionId: string}>();
    const { t } = useTranslation();

    const [state, setState] = React.useState(ManualFromVideoState.Upload);
    const [uploadedFileName, setUploadedFileName] = React.useState("");
    const [documentTitle, setDocumentTitle] = React.useState("");
    const [context, setContext] = React.useState("");
    const [videoId, setVideoId] = React.useState<string | null>(null);
    const [binderId, setBinderId] = React.useState<string | null>(null);
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);
    const history = useHistory();

    const uploadVideoMutation = useUploadVideo({
        onSuccess: (videoId) => {
            setVideoId(videoId);
            setState(ManualFromVideoState.Uploaded);
        },
        onError: (_error) => {
            setState(ManualFromVideoState.Upload);
        },
    });

    const generateDocumentMutation = useGenerateDocument({
        onSuccess: (binderId) => {
            setBinderId(binderId);
            setState(ManualFromVideoState.Generated);
        },
        onError: () => {
            setState(ManualFromVideoState.Uploaded);
        },
    });

    const onRedirect = useCallback(() => history.push(`${COMPOSER_ROUTE}/${binderId}`), [binderId, history]);
    useRedirectWhenGenerated(state, onRedirect, binderId);

    const handleSelectVideo = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFileName(file.name);
            setState(ManualFromVideoState.Uploading);
            uploadVideoMutation.mutate({ file });
        }
        // Reset the input value so the same file can be selected again
        event.target.value = "";
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounterRef.current = 0;
        try {
            const files = await fileListToFiles(e.dataTransfer?.files, { includeVideos: true });
            if (files.length > 0) {
                const file = files[0];
                setUploadedFileName(file.name);
                setState(ManualFromVideoState.Uploading);
                uploadVideoMutation.mutate({ file });
            }
        } catch (error) {
            if (error.name === UnsupportedMedia.NAME) {
                FlashMessages.error(error.description || error.message);
            } else {
                // eslint-disable-next-line no-console
                console.error("File drop error", error);
            }
            setState(ManualFromVideoState.Upload);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const renderPrimaryContent = () => {
        if (state === ManualFromVideoState.Upload) {
            return (
                <>
                    <div className="section-heading">
                        <h2 className="manual-from-video-title-secondary">{t("DocManagement_DocFromVideo_UploadCta1")}</h2>
                        <p className="manual-from-video-subtitle">
                            {t("DocManagement_DocFromVideo_Instruction1")}
                        </p>
                    </div>

                    <div
                        className={cx("upload-area", { "upload-area--dragging": isDraggingOver })}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="upload-content">
                            <div className="upload-text-content">
                                <h3 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_DropCta")}</h3>
                                <p className="manual-from-video-subtitle">
                                    {t("DocManagement_DocFromVideo_Instruction2")}
                                </p>
                            </div>
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={getAcceptVideosString()}
                                    onChange={handleFileSelected}
                                    style={{ display: "none" }}
                                />
                                <Button
                                    className="select-video-btn"
                                    text={t(TK.DocManagement_DocFromVideo_SelectVideoCta)}
                                    onClick={handleSelectVideo}
                                />
                            </>
                        </div>
                    </div>
                </>
            );
        }

        if (state === ManualFromVideoState.Uploading) {
            return (
                <div className="upload-progress-section">
                    <h2 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_UploadingTitle")}</h2>
                    <p className="manual-from-video-subtitle">{t("DocManagement_DocFromVideo_UploadingSubtitle")}...</p>
                    <ProgressBar />
                    <p className="manual-from-video-meta-text">{t("DocManagement_DocFromVideo_UploadingFileIndication")}: {uploadedFileName}</p>
                </div>
            );
        }

        if (state === ManualFromVideoState.Uploaded) {
            return (
                <div className="upload-complete-section">
                    <h2 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_UploadedSubtitle")}</h2>
                    <ProgressBar complete />
                    <p className="manual-from-video-meta-text">{uploadedFileName}</p>
                </div>
            );
        }

        if (state === ManualFromVideoState.Generating) {
            return (
                <div className="generating-section">
                    <h2 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_GeneratingTitle")}</h2>
                    <p className="manual-from-video-subtitle">{t("DocManagement_DocFromVideo_UploadingSubtitle")}</p>
                    <ProgressBar />
                </div>
            );
        }

        if (state === ManualFromVideoState.Generated) {
            return (
                <div className="generated-section">
                    <h2 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_ReadyTitle")}</h2>
                    <ProgressBar complete />
                </div>
            );
        }

        return null;
    };

    const renderSecondaryContent = () => {
        if (state === ManualFromVideoState.Generating || state === ManualFromVideoState.Generated) {
            return (
                <>
                    <Button
                        CTA
                        className="view-document-btn"
                        text={t("DocManagement_DocFromVideo_ViewBtnCaption")}
                        onClick={() => onRedirect()}
                        isEnabled={state === ManualFromVideoState.Generated}
                    />
                    {state === ManualFromVideoState.Generating && (
                        <p className="manual-from-video-meta-text manual-from-video-meta-text--center">
                            {t(TK.DocManagement_DocFromVideo_ViewBtnWait)}
                        </p>
                    )}
                </>
            );
        }

        return (
            <>
                <h2 className="manual-from-video-title-primary">{t("DocManagement_DocFromVideo_DocDetailsTitle")}</h2>
                <p className="manual-from-video-subtitle">
                    {t("DocManagement_DocFromVideo_DocDetailsSubtitle")}
                </p>

                <div className="form-group">
                    <label className="form-label">{`${t(TK.General_Title)} (${t(TK.General_Optional)})`}</label>
                    <Input
                        value={documentTitle}
                        onChange={(v => setDocumentTitle(v))}
                        placeholder={t("DocManagement_DocFromVideo_DocDetailsTitlePlaceholder")}
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{`${t(TK.DocManagement_DocFromVideo_DocDetailsContextTitle)} (${t(TK.General_Optional)})`}</label>
                    <textarea
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder={t("DocManagement_DocFromVideo_DocDetailsContextPlaceholder")}
                        className="form-textarea"
                        rows={4}
                    />
                </div>

                <Button
                    CTA
                    className="generate-document-btn"
                    text={t("DocManagement_DocFromVideo_DocDetailsGenerateBtnCaption")}
                    onClick={() => {
                        if (videoId) {
                            setState(ManualFromVideoState.Generating);
                            generateDocumentMutation.mutate({
                                videoId,
                                title: documentTitle,
                                context,
                                collectionId
                            });
                        }
                    }}
                    isEnabled={state === ManualFromVideoState.Uploaded && videoId !== null}
                />

                {state === ManualFromVideoState.Uploading && (
                    <p className="manual-from-video-meta-text manual-from-video-meta-text--center">
                        {t("DocManagement_DocFromVideo_DocDetailsGenerateBtnWait")}
                    </p>
                )}
            </>
        );
    };

    return (
        <div className="manual-from-video">
            <div className="manual-from-video-container">
                <h1 className="manual-from-video-heading">{t("DocManagement_DocFromVideo_Title")}</h1>
                <div className={cx("primary-section", {
                    "primary-section--upload": state === ManualFromVideoState.Upload,
                    "primary-section--uploading": state === ManualFromVideoState.Uploading,
                    "primary-section--uploaded": state === ManualFromVideoState.Uploaded,
                    "primary-section--generating": state === ManualFromVideoState.Generating,
                    "primary-section--generated": state === ManualFromVideoState.Generated,
                })}>
                    {renderPrimaryContent()}
                </div>
                {state !== ManualFromVideoState.Upload && (
                    <div className="secondary-section">
                        {renderSecondaryContent()}
                    </div>
                )}
            </div>
        </div>
    );
}
