import { isUnsupportedMediaError, isUnsupportedMediaTypeError } from "./visuals";
import { TranslationKeys as TK } from "../../../i18n/translations";
import i18n from "../../../i18n";

export const VIDEO_THUMBNAIL_ERROR = "VISUAL_THUMBNAIL_ERROR";

export const handleVisualError = (e: Error, showErrorMessage: (msg: string) => void): boolean => {
    if (e.message === VIDEO_THUMBNAIL_ERROR) {
        showErrorMessage(i18n.t(TK.Visual_CanNotUseVideoAsThumbnail));
        return true;
    }
    return false;
}

export const handleVisualUploadError = (
    e: Error,
    showErrorMessage: (msg: string) => void,
    multipleVisuals = false
): void => {
    const handled = handleVisualError(e, showErrorMessage);
    if (handled) {
        return;
    }
    if (isUnsupportedMediaTypeError(e)) {
        if (isUnsupportedMediaError(e) && e.translationKey) {
            showErrorMessage(i18n.t(e.translationKey, e.translationParams));
            return;
        }
        showErrorMessage(e.message);
        return;
    }
    showErrorMessage(i18n.t(TK.Visual_CouldNotUploadMedia, { count: multipleVisuals ? 2 : 1 }));
}