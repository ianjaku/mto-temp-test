import { IThumbnail } from "../clients/repositoryservice/v3/contract";

export const DEFAULT_COVER_IMAGE = "https://s3-eu-west-1.amazonaws.com/manualto-images/document-cover-default.png";
export const DEFAULT_FIT_BEHAVIOUR = "fit";
export const DEFAULT_THUMBNAIL_BG_COLOR = "#000000";

export const createDefaultCoverThumbnail = (): IThumbnail => ({
    medium: DEFAULT_COVER_IMAGE,
    fitBehaviour: "fit",
    bgColor: "transparent"
});

/**
 * Whenever a binder changes, we require the lastModifiedDate of one of the chunks to be changed
 * (unless skipDateChangeMarkerCheck is passed)
 * 
 * The way we check this, is by setting the date of the changed chunk(s) to DATE_CHANGED_MARKER (usually using updateMetaTimestamp)
 * then, in "maybeCleanMarkers" we replace the markers with the current date we received from the server.
 */
export const DATE_CHANGED_MARKER = "DATE_CHANGED_MARKER";