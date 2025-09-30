import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateBinderId,
    validateCollectionId,
    validateInteger,
    validateNumberInput,
    validateStringArrayInput,
    validateStringInput,
} from "../../validation";
import type { ContentServiceContract } from "./contract";

export default function getRoutes(): { [name in keyof ContentServiceContract]: AppRoute; } {
    return {
        fileUpload: {
            description: "Uploads a file for LLM usage",
            path: "/fileUpload/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        forwardFileUpload: {
            description: "Forward a file upload request",
            path: "/forwardFileUpload/:accountId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        generateManual: {
            description: "Generate a manual from uploaded files",
            path: "/generateManual",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "collectionId", validateCollectionId],
                [fromBody, "customPrompt", validateStringInput, "optional"],
                [fromBody, "fileIds", validateStringArrayInput],
                [fromBody, "title", validateStringInput, "optional"],
            ],
            successStatus: HTTPStatusCode.OK
        },
        optimizeChunkContent: {
            description: "Optimize content of a single chunk",
            path: "/optimizeChunkContent",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "chunkIdx", validateInteger],
                [fromBody, "langIdx", validateInteger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        optimizeBinderContent: {
            description: "Optimizes content of the whole Binder",
            path: "/optimizeBinderContent",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "langIdx", validateInteger],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateVisualTrimSettings: {
            description: "Update visual trim settings",
            path: "/visualTrimSettings/:binderId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "chunkIdx", validateNumberInput],
                [fromBody, "visualIdx", validateNumberInput],
                [fromBody, "startTimeMs", validateNumberInput],
                [fromBody, "endTimeMs", validateNumberInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
    };
}
