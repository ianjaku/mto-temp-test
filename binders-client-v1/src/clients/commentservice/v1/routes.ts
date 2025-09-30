import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateArrayInput,
    validateBinderId,
    validateCommentEdits,
    validatePublicationId,
    validateStringInput,
} from "../../validation";
import type { CommentServiceContract } from "./contract";
import { validateBinderComment } from "./validation";

export default function getRoutes(): { [name in keyof CommentServiceContract]: AppRoute } {
    return {
        createReaderComment: {
            description: "Create a comment from the reader",
            path: "/createReaderComment",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "publicationId", validatePublicationId],
                [fromBody, "chunkId", validateStringInput],
                [fromBody, "text", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        deleteBinderComment: {
            description: "Delete a binderComment",
            path: "/bindercomments",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "threadId", validateStringInput],
                [fromBody, "commentId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteOwnComment: {
            description: "Allows a user to delete their comment",
            path: "/deleteOwnComment",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "commentId", validateStringInput],
                [fromBody, "threadId", validateStringInput],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findCommentThreads: {
            description: "Find all comment threads given a filter",
            path: "/findCommentThreads",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK,
        },
        getCommentThreads: {
            description: "List all comment threads for a given binder",
            path: "/bindercomments/threads/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getComments: {
            description: "Find all reader and editor comments given a filter",
            path: "/getComments",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getReaderComments: {
            description: "Get all reader comments for the given user",
            path: "/getReaderComments/:binderId/:accountId/:options",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        insertBinderComment: {
            description: "Insert a binderComment",
            path: "/bindercomments",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "chunkId", validateStringInput],
                [fromBody, "languageCode", validateStringInput],
                [fromBody, "binderComment", validateBinderComment],
            ],
            successStatus: HTTPStatusCode.OK
        },
        migrateCommentThreads: {
            description: "Merge the comment of 2 chunks",
            path: "/bindercomments/migratethreads",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "sourceChunkIds", validateArrayInput("uuids", validateStringInput)],
                [fromBody, "targetChunkId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        resolveCommentThread: {
            description: "Resolve a comment thread",
            path: "/bindercomments/resolvethread",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "threadId", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateReaderComment: {
            description: "Updates a reader comment",
            path: "/updateReaderComment/:threadId/:commentId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "threadId", validateStringInput],
                [fromParams, "commentId", validateStringInput],
                [fromBody, "commentEdits", validateCommentEdits],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
    };
}
