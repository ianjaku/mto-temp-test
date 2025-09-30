import {
    APIDeleteVisual,
    APIGetVisual,
    APIListVisuals,
    APIUpdateVisualAudio,
    APIUpdateVisualAutoPlay,
    APIUpdateVisualBgColor,
    APIUpdateVisualFitBehaviour,
    APIUpdateVisualLanguageCodes,
    APIUpdateVisualRotation,
    APIUploadVisualFiles
} from "./api";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import {
    UPLOAD_MAX_FILE_SIZE,
    Visual,
    VisualKind
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    VIDEO_THUMBNAIL_ERROR,
    handleVisualUploadError
} from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import {
    patchAllTextMetaTimestamps,
    setThumbnailDetails
} from "@binders/client/lib/binders/patching";
import { prepareVisualForAttach, toBinderVisual } from "./helper";
import { ACTION_SET_THUMBNAIL } from "../documents/store";
import AccountStore from "../accounts/store";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { BinderMediaStoreActions } from "./binder-media-store";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    FEATURE_NOCDN,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import { FlashMessages } from "../logging/FlashMessages";
import { IVisualPosition } from "../documents/Composer/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UpdatePatch } from "tcomb";
import { addImage } from "../documents/actions/editing";
import debounce from "lodash.debounce";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getCurrentUserId } from "../stores/my-details-store";
import { humanizeBytes } from "@binders/client/lib/util/formatting";
import i18n from "@binders/client/lib/react/i18n";
import { replaceVisual as replaceBinderVisual } from "../documents/actions/editing";
import { thumbnailHasId } from "./helper";
import { visualToThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

export const loadBinderVisuals = (binder: { kind: "collection", id: string } | (Binder & { kind: string })): void => {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
    BinderMediaStoreActions.triggerVisualsFetch(binder, (binderId: string) => APIListVisuals(binderId, { cdnnify }));
}

export async function refetchVisual(binderId: string, visualId: string): Promise<void> {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
    const visual = await APIGetVisual(binderId, visualId, { cdnnify });
    BinderMediaStoreActions.putVisual(visual);
}

export const clearBinderVisuals = (): void => {
    BinderMediaStoreActions.clearVisualsData();
}

export const updateVisualFitBehaviour = async (binderId: string, visualId: string, fitBehaviour: FitBehaviour): Promise<void> => {
    const updatedVisual = await APIUpdateVisualFitBehaviour(binderId, visualId, fitBehaviour);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "fitBehaviour", updatedVisual.fitBehaviour as "fit" | "crop");
}

export const updateVisualRotation = async (binderId: string, visualId: string, rotation: number): Promise<void> => {
    const updatedVisual = await APIUpdateVisualRotation(binderId, visualId, rotation);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "rotation", updatedVisual.rotation);
}

export const updateVisualBgColor = async (binderId: string, visualId: string, bgColor: string): Promise<void> => {
    const updatedVisual = await APIUpdateVisualBgColor(binderId, visualId, bgColor);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "bgColor", updatedVisual.bgColor);
}

export const updateVisualLanguageCodes = async (binderId: string, visualId: string, languageCodes: string[]): Promise<void> => {
    const updatedVisual = await APIUpdateVisualLanguageCodes(binderId, visualId, languageCodes);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "languageCodes", updatedVisual.languageCodes);
}

export const updateVisualAudio = async (binderId: string, visualId: string, audioEnabled: boolean): Promise<void> => {
    const updatedVisual = await APIUpdateVisualAudio(binderId, visualId, audioEnabled);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "audioEnabled", updatedVisual.audioEnabled);
}

export const updateVisualAutoPlay = async (binderId: string, visualId: string, autoPlay: boolean): Promise<void> => {
    const updatedVisual = await APIUpdateVisualAutoPlay(binderId, visualId, autoPlay);
    BinderMediaStoreActions.updateVisualProp(updatedVisual.id, "autoPlay", updatedVisual.autoPlay);
}

export const deleteBinderVisual = (binderId: string, visualId: string): void => {
    APIDeleteVisual(binderId, visualId);
    BinderMediaStoreActions.deleteVisual(visualId);
}

const onVisualUploadProgress = (clientId: string, percentUploaded: number, binderId: string) => {
    BinderMediaStoreActions.updateVisualUploadProgress(binderId, clientId, percentUploaded);
}

const onVisualUploadProgressDebounced = debounce(onVisualUploadProgress, 200, { leading: true });

const onVisualUploadEnd = (clientIds: string[], binderId: string) => {
    BinderMediaStoreActions.deletePreviewVisuals(binderId, clientIds);
}

function checkIfVideoThumbnail(visualFiles: File[], position: IVisualPosition): void {
    const [firstVisual] = visualFiles;
    const { chunkIndex, visualIndex } = position;
    const isThumbnail = chunkIndex === 0 && visualIndex === 0;
    const isVideo = firstVisual.type.startsWith("video");
    if (isThumbnail && isVideo) {
        throw new Error(VIDEO_THUMBNAIL_ERROR);
    }
}

export const uploadVisualFiles = async (
    binder: BinderClass,
    files: File[],
    imageModuleKey: string,
    positions: IVisualPosition[],
    accountId: string
): Promise<UpdatePatch[]> => {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));

    for (const file of files) {
        if (file.size > UPLOAD_MAX_FILE_SIZE) {
            const humanizedMaxSize = humanizeBytes(UPLOAD_MAX_FILE_SIZE);
            FlashMessages.error(i18n.t(TK.General_FileTooLarge, { file: file.name, humanizedMaxSize }), true);
            return [];
        }
    }
    const includesSetDocumentThumbnailAction = positions.some(p => p.chunkIndex === 0);
    if (includesSetDocumentThumbnailAction) {
        if (files.length > 1) {
            FlashMessages.error(i18n.t(TK.Visual_ThumbnailIsUniqueVisual), true);
            return [];
        }
        positions.forEach((position) => checkIfVideoThumbnail(files, position));
    }
    const visualFilesWithClientId = files.map(asVisualFileWithClientId);
    BinderMediaStoreActions.acceptVisuals(binder.id, visualFilesWithClientId, positions);

    let newVisualIds: string[];
    try {
        newVisualIds = await APIUploadVisualFiles(
            binder.id,
            visualFilesWithClientId,
            (clientId: string, percentUploaded: number) => onVisualUploadProgressDebounced(
                clientId,
                percentUploaded,
                binder.id,
            ),
            () => onVisualUploadEnd(
                visualFilesWithClientId.map(v => v.clientId),
                binder.id,
            ),
            accountId,
        );
        verifyUploadsPartialFail(visualFilesWithClientId, newVisualIds);
    } catch (err) {
        handleVisualUploadError(
            err,
            msg => FlashMessages.error(msg, true),
            (visualFilesWithClientId || []).length > 1
        )
        BinderMediaStoreActions.deletePreviewVisuals(binder.id, newVisualIds);
        throw err;
    }
    const visuals = (await APIListVisuals(binder.id, { cdnnify }))
        .filter(visual => newVisualIds.includes(visual.id))
        .map(visual => toBinderVisual(visual));

    if (!positions.some(p => p.chunkIndex !== undefined)) {
        completeBinderVisuals(binder, visuals);
        return [];
    }

    const patches = positions.reduce((reduced, position) => {
        const { chunkIndex, visualIndex } = position || {};
        const isToThumbnail = position.chunkIndex === 0;
        if (isToThumbnail) {
            const thumbnail = visualToThumbnail(visuals[0]);
            const patches: UpdatePatch[] = [
                setThumbnailDetails(binder, thumbnail),
                patchAllTextMetaTimestamps(binder)
            ];
            dispatch({
                type: ACTION_SET_THUMBNAIL,
                body: thumbnail,
            });
            return [...reduced, ...patches];
        }
        let patches: UpdatePatch[] = [];
        // chunkIndex: -1 is in media pane
        // chunkIndex: 0 is a chunk
        if (chunkIndex > 0) {
            const toChunkIndex = chunkIndex - 1;
            let toVisualIndex = visualIndex;
            patches = visuals.map(visual =>
                addImage(binder, imageModuleKey, toChunkIndex, toVisualIndex++, prepareVisualForAttach(visual))
            );
            patches.push(patchAllTextMetaTimestamps(binder));
        }
        return [...reduced, ...patches];
    }, [] as UpdatePatch[]);

    completeBinderVisuals(binder, visuals);
    return patches;
}

const verifyUploadsPartialFail = (files: File[], newVisualIds: string[]) => {
    const someUploadsHaveFailed = newVisualIds.length < files.length;
    if (someUploadsHaveFailed) {
        FlashMessages.error(i18n.t(TK.Visual_CouldNotUpload));
    }
}

const completeBinderVisuals = (binder, visuals) => {
    const { id: binderId, accountId } = binder;
    BinderMediaStoreActions.completeVisuals(visuals);
    visuals.forEach(visual => {
        const logData = { binderId, imageId: visual.id };
        eventQueue.log(
            EventType.IMAGE_UPLOADED,
            accountId,
            logData,
            false,
            getCurrentUserId(),
        );
    });
    captureFrontendEvent(
        EditorEvent.VisualUploaded,
        {
            count: visuals.length,
            videoCount: visuals.filter(v => v.kind === VisualKind.VIDEO).length,
            imageCount: visuals.filter(v => v.kind === VisualKind.IMAGE).length,
        }
    );
}

export const replaceVisual = async (
    binder: BinderClass,
    imageModuleKey: string,
    oldVisual: Visual,
    newVisualFile: File,
    onReplaceVisualInComposer: (patch, affectedChunkIndices: number[]) => void,
    accountId: string
): Promise<void> => {
    const accountFeaturesWD = AccountStore.getAccountFeatures();
    const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
    const newVisualFileWithClientId = asVisualFileWithClientId(newVisualFile);
    BinderMediaStoreActions.acceptVisuals(binder.id, [newVisualFileWithClientId]);
    const newVisualId = (
        await APIUploadVisualFiles(
            binder.id,
            [newVisualFileWithClientId],
            (clientId: string, percentUploaded: number) => onVisualUploadProgress(
                clientId,
                percentUploaded,
                binder.id,
            ),
            () => onVisualUploadEnd(
                [newVisualFileWithClientId.clientId],
                binder.id,
            ),
            accountId,
        )
    ).pop();
    if (newVisualId === oldVisual.id) {
        FlashMessages.info(i18n.t(TK.Visual_AlreadyUploaded));
        return;
    }
    const backgroundColor = oldVisual.bgColor && oldVisual.bgColor.replace("#", "").toLowerCase();
    await APIUpdateVisualBgColor(binder.id, newVisualId, backgroundColor || "ffffff");
    await APIUpdateVisualFitBehaviour(binder.id, newVisualId, oldVisual.fitBehaviour);
    const uploadedVisual = (await APIListVisuals(binder.id, { cdnnify }))
        .find(visual => visual.id === newVisualId);
    const newBinderVisual = toBinderVisual(uploadedVisual);
    const patch = binder => [replaceBinderVisual(binder, imageModuleKey, oldVisual, prepareVisualForAttach(newBinderVisual))];
    BinderMediaStoreActions.completeVisuals([newBinderVisual]);

    const visualOccursInThumbnail = thumbnailHasId(binder["thumbnail"], oldVisual.id);
    const visualIndicesMap = binder.getVisualIndices(imageModuleKey, oldVisual);
    const imageModuleIndex = binder.getImagesModuleIndex(imageModuleKey);

    const visualIndicesToReplace = [
        ...(visualOccursInThumbnail ? [-1] : []),
        ...Object.keys(visualIndicesMap[imageModuleIndex]).map(i => parseInt(i, 10)),
    ];

    onReplaceVisualInComposer(patch, visualIndicesToReplace);

    if (!(newVisualId.startsWith("vid-") && visualOccursInThumbnail)) {
        BinderMediaStoreActions.deleteVisual(oldVisual.id);
        APIDeleteVisual(binder.id, oldVisual.id);
    } else {
        throw new Error(i18n.t(TK.Visual_CanNotUseVideoAsThumbnail));
    }
}

const asVisualFileWithClientId = (file: File): File & { clientId: string } =>
    Object.assign(file, { clientId: Math.random().toString().substring(2) });
