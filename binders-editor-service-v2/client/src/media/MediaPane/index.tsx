import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    UnsupportedMedia,
    fileListToFiles
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import {
    VisualsFetchState,
    useBinderPreviewVisuals,
    useBinderVisuals,
    useBinderVisualsFetchState,
    useDraggingInfo
} from "../binder-media-store";
import { deleteBinderVisual, replaceVisual, uploadVisualFiles } from "../actions";
import { useActiveAccountId, useActiveAccountSettings } from "../../accounts/hooks";
import Binder from "@binders/client/lib/binders/custom/class";
import Button from "@binders/ui-kit/lib/elements/button";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FlashMessages } from "../../logging/FlashMessages";
import Loader from "@binders/ui-kit/lib/elements/loader/index";
import Modal from "@binders/ui-kit/lib/elements/modal";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { SelectedChunkDetails } from "../../documents/Composer/components/BinderLanguage/Chunk";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { VisualDetails } from "./VisualDetails";
import VisualInput from "../../documents/Composer/components/VisualInput";
import VisualProperties from "./VisualProperties";
import VisualsGallery from "./VisualsGallery";
import { createPortal } from "react-dom";
import {
    handleVisualUploadError
} from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import { useIsTest } from "../../browsing/hooks";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useTranslation } from "react-i18next";
import "./MediaPane.styl";

export enum MediaPaneUsage {
    Composer = "composer",
    CollectionEdit = "collectionEdit",
}

type MediaPaneProps = {
    binder: Binder | DocumentCollection,
    imageModuleKey: string,
    usage: MediaPaneUsage,
    modalPlaceholder: HTMLElement,
    onDoubleClickVisual: (visual) => void,
    onReplaceVisual?: (patch, affectedChunkIndices: number[]) => void,
    onSelect?: (visual) => void,
    onUpdateVisual: (id, moduleKey, update) => void,
    selectedChunkDetails?: SelectedChunkDetails,
    selectOtherOnDelete?: boolean, // When the active visual is deleted, select another visual
    selectedVisualId: string,
};

const MediaPane: React.FC<MediaPaneProps> = ({
    binder,
    imageModuleKey,
    modalPlaceholder,
    onDoubleClickVisual,
    onReplaceVisual,
    onSelect,
    onUpdateVisual,
    selectedChunkDetails,
    selectOtherOnDelete,
    selectedVisualId: propsSelectedVisualId,
    usage,
}) => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    const accountSettings = useActiveAccountSettings();
    const draggingInfo = useDraggingInfo();
    const visuals = useBinderVisuals();
    const previousVisuals = usePrevious(visuals);
    const previewVisuals = useBinderPreviewVisuals(binder.id);
    const previousSelectedChunkDetails = usePrevious(selectedChunkDetails);
    const [draggingIntoMediaPane, setDraggingIntoMediaPane] = React.useState(false);
    const [selectedVisualId, setSelectedVisualId] = React.useState<string | undefined>(undefined);
    const previousPropSelectedVisualId = usePrevious(propsSelectedVisualId);
    const [visualToReplace, setVisualToReplace] = React.useState(undefined);
    const [visualIdFacingDeletion, setVisualIdFacingDeletion] = React.useState<string | undefined>(undefined);
    const [imageFilter, setImageFilter] = React.useState<string>("");
    const fileSelector = React.useRef<HTMLInputElement>(null);
    const isTest = useIsTest();

    React.useEffect(() => {
        const currentSelectedVisual = visuals && previousVisuals && visuals.length !== previousVisuals.length ?
            visuals.at(-1) :
            undefined;
        if (currentSelectedVisual) {
            onSelect?.(currentSelectedVisual);
            setSelectedVisualId(currentSelectedVisual.id);
        }
    }, [onSelect, previousVisuals, visuals]);

    const onMediaPaneDragEnter = React.useCallback((e) => {
        e.preventDefault();
        if (draggingInfo && !draggingInfo.isDragging) { // not dragging visuals, but os files
            setDraggingIntoMediaPane(true);
        }
    }, [draggingInfo]);

    const doDelete = React.useCallback(() => {
        if (visuals.length === 1 && (binder as DocumentCollection).isRootCollection) {
            FlashMessages.error(t(TK.Visual_CannotDeleteLastRootCollectionThumbnail));
            return;
        }
        deleteBinderVisual(binder.id, visualIdFacingDeletion);
        if (selectOtherOnDelete) {
            const newlySelectedVisual = visuals.find(visual => visual.id !== visualIdFacingDeletion);
            if (newlySelectedVisual) {
                setSelectedVisualId(newlySelectedVisual?.id);
                onSelect?.(newlySelectedVisual);
            }
        } else {
            setSelectedVisualId(undefined);
        }
        setVisualIdFacingDeletion(undefined);
        FlashMessages.success(t(TK.Visual_MediaHasBeenDeleted));
    }, [binder, onSelect, selectOtherOnDelete, t, visualIdFacingDeletion, visuals]);

    const renderDeletionModal = React.useCallback(() => {
        const modalButtons = [
            <Button key="cancel" text={t(TK.General_Cancel)} secondary onClick={() => setVisualIdFacingDeletion(undefined)} />,
            <Button key="ok" text={t(TK.General_Ok)} onClick={doDelete} />,
        ];
        return createPortal(
            (
                <Modal title={t(TK.Visual_DeleteMediaItem)} buttons={modalButtons} onHide={() => setVisualIdFacingDeletion(undefined)}>
                    <p>
                        {t(TK.Visual_ConfirmMediaItemDeletionMessage)}
                    </p>
                </Modal>
            ), modalPlaceholder);
    }, [doDelete, modalPlaceholder, t]);

    const onChangeFilter = React.useCallback((imageFilter: string) => {
        captureFrontendEvent(EditorEvent.MediaPaneSearchVisual, { query: imageFilter });
        setImageFilter(imageFilter);
    }, []);

    const onClickUploadVisual = React.useCallback(() => {
        fileSelector?.current?.click();
        captureFrontendEvent(EditorEvent.MediaPaneUploadButtonClicked);
    }, []);

    const onDeleteVisual = React.useCallback((visualId: string) => {
        if (visuals.length === 1 && (binder as DocumentCollection).isRootCollection) {
            FlashMessages.error(t(TK.Visual_CannotDeleteLastRootCollectionThumbnail));
        } else {
            setVisualIdFacingDeletion(visualId);
        }
    }, [binder, t, visuals.length]);

    const uploadBinderVisualFiles = React.useCallback(async (binder: Binder, visualFiles: File[]) => {
        try {
            if (visualFiles) {
                const position = { chunkIndex: -1, visualIndex: -1 };
                await uploadVisualFiles(binder, visualFiles, undefined, [position], accountId);
            }
        } catch (e) {
            handleVisualUploadError(
                e,
                msg => FlashMessages.error(msg, true),
                visualFiles && visualFiles.length > 1
            );
        }
    }, [accountId]);

    const onSelectVisualFiles = React.useCallback(async (e) => {
        const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        e.persist();
        try {
            const visualFiles = await fileListToFiles(files);
            if (fileSelector?.current) {
                fileSelector.current.value = "";
            }
            if (visualFiles.length > 0) {
                if (visualToReplace) {
                    try {
                        await replaceVisual(
                            binder as Binder,
                            imageModuleKey,
                            visualToReplace,
                            visualFiles[0],
                            onReplaceVisual,
                            accountId,
                        );
                    } catch (ex) {
                        FlashMessages.error(ex);
                    }
                }
                else {
                    await uploadBinderVisualFiles(binder as Binder, visualFiles);
                }
            }
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessages.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    }, [accountId, binder, imageModuleKey, onReplaceVisual, uploadBinderVisualFiles, visualToReplace]);

    const filteredVisuals = React.useMemo(() => {
        if (!imageFilter) {
            return visuals;
        }
        const regexFilter = new RegExp(imageFilter, "i");
        return visuals.filter(visual => visual.filename && visual.filename.match(regexFilter));
    }, [imageFilter, visuals]);
    const galleryVisuals = React.useMemo(() => [...previewVisuals, ...filteredVisuals], [previewVisuals, filteredVisuals]);

    const onMediaPaneDrop = React.useCallback(async (e) => {
        e.preventDefault();
        setDraggingIntoMediaPane(false);
        try {
            const visualFiles = await fileListToFiles(e.dataTransfer && e.dataTransfer.files);
            if (visualFiles.length) {
                await uploadBinderVisualFiles(binder as Binder, visualFiles);
            }
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessages.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    }, [binder, uploadBinderVisualFiles]);

    React.useEffect(() => {
        if (!previousSelectedChunkDetails || !selectedChunkDetails) {
            return;
        }
        if (previousSelectedChunkDetails.index !== selectedChunkDetails.index) {
            const visual = visuals.find(visual => visual.chunks && selectedChunkDetails.index in visual.chunks);
            if (visual) {
                setSelectedVisualId(visual.id);
            }
        }
        if ((!previousPropSelectedVisualId && propsSelectedVisualId) || (previousPropSelectedVisualId !== propsSelectedVisualId)) {
            setSelectedVisualId(propsSelectedVisualId);
        }
    }, [previousPropSelectedVisualId, previousSelectedChunkDetails, propsSelectedVisualId, selectedChunkDetails, visuals]);

    const selectedVisual = React.useMemo(() => visuals.find(visual => visual.id === selectedVisualId), [selectedVisualId, visuals]);
    return (
        <div
            className="media-pane"
            onDragEnter={onMediaPaneDragEnter}
        >
            {visualIdFacingDeletion && renderDeletionModal()}
            {visuals.length > 0 && (
                <SearchInput
                    inverted={usage === MediaPaneUsage.Composer}
                    value={imageFilter}
                    onChange={value => onChangeFilter(value)}
                    placeholder={t(TK.Visual_FilterByName)}
                />
            )}
            <div className="binder-visuals" >
                <VisualsGallery
                    usage={usage}
                    onClickUploadVisual={onClickUploadVisual}
                    onDeleteVisual={onDeleteVisual}
                    onSelectVisual={(visualId) => {
                        setSelectedVisualId(visualId);
                        onSelect?.(visuals.find(visual => visual.id === visualId));
                    }}
                    selectedVisualId={selectedVisualId}
                    visuals={galleryVisuals}
                />
            </div>
            {selectedVisual && usage === MediaPaneUsage.CollectionEdit && (
                <VisualProperties
                    binder={binder}
                    imageModuleKey={imageModuleKey}
                    visual={selectedVisual}
                    onUpdateVisual={onUpdateVisual}
                    onDeleteVisual={onDeleteVisual}
                    onReplaceVisual={(visualToReplace) => {
                        setVisualToReplace(visualToReplace);
                        setSelectedVisualId(undefined);
                        if (!isTest) {
                            fileSelector?.current?.click();
                        }
                    }}
                    label={t(TK.Visual_ImagePreferences)}
                    onVisualViewLarge={onDoubleClickVisual}
                    accountSettings={accountSettings}
                />
            )}
            {selectedVisual && usage === MediaPaneUsage.Composer && (
                <VisualDetails
                    imageModuleKey={imageModuleKey}
                    visual={selectedVisual}
                    onUpdateVisual={onUpdateVisual}
                    onDeleteVisual={onDeleteVisual}
                    onReplaceVisual={(visualToReplace) => {
                        setVisualToReplace(visualToReplace);
                        setSelectedVisualId(undefined);
                        if (!isTest) {
                            fileSelector?.current?.click();
                        }
                    }}
                    onVisualViewLarge={onDoubleClickVisual}
                />
            )}
            {!selectedVisual && <div className={usage === MediaPaneUsage.CollectionEdit ? "visual-properties-placeholder-modal" : "visual-properties-placeholder-pane"} />}
            <VisualInput
                ref={fileSelector}
                onChange={onSelectVisualFiles}
            />
            {draggingIntoMediaPane && (
                <div
                    className="media-pane-dropfilesarea"
                    onDragOver={(e) => {
                        e.preventDefault();
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        setDraggingIntoMediaPane(false);
                    }}
                    onDrop={onMediaPaneDrop}
                >
                    <span className="media-pane-dropfilesarea-label">
                        {t(TK.Visual_DropFilesToAdd)}
                    </span>
                </div>
            )}
        </div>
    );
}

const MediaPaneWithFallback: React.FC<MediaPaneProps> = (props) => {
    const { t } = useTranslation();
    const visualsFetchState = useBinderVisualsFetchState();
    if (visualsFetchState === VisualsFetchState.FETCHING) {
        return <Loader text={t(TK.Visual_LoadingMedia)} />;
    } else if (visualsFetchState === VisualsFetchState.ERROR || visualsFetchState === VisualsFetchState.NOT_STARTED) {
        return <span>{t(TK.Exception_SomethingWrong)}</span>
    } else {
        return <MediaPane {...props} />;
    }
}

export default MediaPaneWithFallback;
