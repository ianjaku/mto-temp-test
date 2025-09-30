import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    fromQuery,
    validateAccountId,
    validateArrayInput,
    validateBinderId,
    validateBoolean,
    validateFontStyle,
    validateFontWeight,
    validateHexColorOrTransparent,
    validateImageId,
    validateLanguageCodes,
    validateNumberInput,
    validateScreenshotSize,
    validateStringInput,
    validateVisualFitBehaviour,
    validateVisualId,
    validateVisualIds,
    validateVisualSize,
} from "../../validation";
import {
    validateHardDeleteVisualsMultiFilter,
    validateImageRotation,
    validateKeyFrame,
    validateLogoId,
    validateUploadVisualOptions,
    videoIndexerResultFilterStr,
} from "./validation";
import { ImageServiceContractBuilder } from "./contract";

export default function getRoutes(): { [name in keyof ImageServiceContractBuilder]: AppRoute; } {
    return {
        addLogo: {
            description: "Add logo",
            path: "/binders/branding/:accountId/logo",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        listVisuals: {
            description: "List available visuals in given binder",
            path: "/binders/:binderId/:options?",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getFeedbackAttachmentVisuals: {
            description: "List feedback attachment visuals in given binder",
            path: "/getFeedbackAttachmentVisuals",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getVisual: {
            description: "Get details of the given visual",
            path: "/bindervisuals/:binderId/:visualId/:options?",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        duplicateVisuals: {
            description: "Duplicate visuals from given binder",
            path: "/binders/:binderId/duplicate/:targetId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "targetId", validateBinderId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        uploadVisual: {
            description: "Upload a new visual to a binder",
            path: "/binders/:binderId/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "accountId", validateAccountId],
                [fromQuery, "options", c => validateUploadVisualOptions(JSON.parse(decodeURIComponent(c))), "optional"]
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteImage: {
            description: "Delete an image from a binder",
            path: "/binders/:binderId/:imageId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "imageId", validateImageId]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        deleteVisuals: {
            description: "Delete multiple visuals from a binder (used atm to delete comment attachments)",
            path: "/binders/deleteVisuals",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "visualIds", validateArrayInput("visualIds", validateVisualId)],
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        hardDeleteVisual: {
            description: "Hard-delete a visual from a binder",
            path: "/hardDeleteVisual/:binderId/:visualId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateImageId]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        hardDeleteVisuals: {
            description: "Hard-delete multiple visuals",
            path: "/hardDeleteVisuals",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromBody, "filter", validateHardDeleteVisualsMultiFilter]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT,
        },
        updateVisualFitBehaviour: {
            description: "Update the fit behaviour ('fit' or 'crop') of the given visual",
            path: "/binders/:binderId/:visualId/fitBehaviour/:fitBehaviour",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromParams, "fitBehaviour", validateVisualFitBehaviour]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualRotation: {
            description: "Update the image rotation of the given visual",
            path: "/binders/:binderId/:visualId/rotation/:rotation",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromParams, "rotation", validateImageRotation]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualBgColor: {
            description: "Update the hex background color of the given visual",
            path: "/binders/:binderId/:visualId/bgColor/:bgColor",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromParams, "bgColor", validateHexColorOrTransparent]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualLanguageCodes: {
            description: "Update the language codes of the given visual",
            path: "/binders/:binderId/:visualId/languageCodes",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromBody, "languageCodes", validateLanguageCodes]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualAudio: {
            description: "Update if audio is enabled on the given visual",
            path: "/binders/:binderId/:visualId/enableAudio",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromBody, "enabled", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualAutoPlay: {
            description: "Update if a video autoplays when the user visits the page",
            path: "/binders/:binderId/:visualId/autoPlay",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromBody, "autoPlay", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        restartVideoProcessing: {
            description: "Restarts the video processing for the passed in visual id",
            path: "/restartVideoProcessing",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "visualId", validateVisualId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        downloadScreenshot: {
            description: "Download the screenhost with the given id at given keyFrame",
            path: "/screenshots/:binderId/:visualId/:keyFrame/:format",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromParams, "keyFrame", validateKeyFrame],
                [fromParams, "format", validateScreenshotSize]
            ],
            successStatus: HTTPStatusCode.OK
        },
        downloadLogo: {
            description: "Download a logo with the give id",
            path: "/logos/:accountId/:logoId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
                [fromParams, "logoId", validateLogoId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        downloadVisualBestFit: {
            description: "Download the most optimal format of visual with the given id",
            path: "/binders/:binderId/:visualId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        downloadVisual: {
            description: "Download the visual with the given id",
            path: "/binders/:binderId/:visualId/:format",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "visualId", validateVisualId],
                [fromParams, "format", validateVisualSize]
            ],
            successStatus: HTTPStatusCode.OK
        },
        downloadFont: {
            description: "Download a font with the given name",
            path: "/fonts/:name/:weight/:style",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "weight", validateFontWeight],
                [fromParams, "style", validateFontStyle]
            ],
            successStatus: HTTPStatusCode.OK
        },
        downloadFontFace: {
            description: "Download a font-face with the given font name",
            path: "/fonts/:name",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "name", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        queryVideoDurations: {
            description: "Returns the duration in ms of the requested video ids",
            path: "/video-durations",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        downloadManifest: {
            description: "Returns the rewritten hls manifest of the requested asset id (safari workaround MT-2421)",
            path: "/hls/:assetId/ORIGINAL.ism/:manifest",
            verb: HTTPVerb.GET,
            validationRules: [
            ],
            successStatus: HTTPStatusCode.OK
        },
        hlsProxy: {
            description: "Proxy endpoint for any hls streaming. Safari does not have any way to handle video auth other than proxying the manifest & segments. This endpoint was created for the Bitmovin videos, although it works with any manifest file.",
            path: "/hlsProxy/:targetUrl/:token",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "targetUrl", validateStringInput],
                [fromParams, "token", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        manifestProxy: {
            description: "Returns a proxied manifest (safari workaround MT-2421)",
            path: "/hls/:assetId/ORIGINAL.ism/:qualityLevel/:manifest",
            verb: HTTPVerb.GET,
            validationRules: [
            ],
            successStatus: HTTPStatusCode.OK
        },
        getVisualByOriginalVisualData: {
            description: "Return visual which is constructed from given original binder and visual id",
            path: "/find-by-original-visual-data/:originalBinderId/:originalVisualId/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        composeVisualFormatUrls: {
            description: "Composes visual urls for given visualIds",
            path: "/composeVisualFormatUrls",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        videoIndexerCallback: {
            description: "Endpoint that Azure's video indexer calls when it has finished indexing a video",
            path: "/videoIndexerCallback",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromQuery, "id", validateStringInput],
                [fromQuery, "state", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findVideoIndexerResults: {
            description: "find videoIndexerResults given a filter",
            path: "/videoIndexerResults/:filter",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "filter", videoIndexerResultFilterStr],
            ],
            successStatus: HTTPStatusCode.OK
        },
        indexVideo: {
            description: "index an existing video with given visualId",
            path: "/videoIndexer",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "visualId", validateVisualId],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getVisualIdByImageUrl: {
            description: "Returns the id of the visual that has the given image url",
            path: "/binderVisuals/visualIdByImageUrl",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "url", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createVideoSasTokens: {
            description: "Generates a string that can be added to an azure storage url to gain access to protected content inside the video container. Used by the Bitmovin implementation.",
            path: "/createVideoSasTokens",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "videoIds", validateVisualIds]
            ],
            successStatus: HTTPStatusCode.CREATED,
        },
        ensureScreenshotAt: {
            description: "Ensure there is a VIDEO_SCREENSHOT around the passed timestamp (ms).",
            path: "/ensureScreenshotAt",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "visualId", validateVisualId],
                [fromBody, "timestampMs", validateNumberInput],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        }
    };
}
