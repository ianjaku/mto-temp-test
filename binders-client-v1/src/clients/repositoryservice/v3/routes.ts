import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    fromQuery,
    validateAccountId,
    validateAccountIdArrayInput,
    validateAccountIds,
    validateArrayInput,
    validateBinderId,
    validateBinderIds,
    validateBindersSearchResultOptions,
    validateBoolean,
    validateCollectionElementsWithInfoOptions,
    validateCollectionId,
    validateDocumentCollectionId,
    validateDomain,
    validateFeedbackParams,
    validateIncludesAccountFilterKeys,
    validateItemId,
    validateItemIds,
    validateItemSearchOptions,
    validateLanguageCode,
    validateNumberArrayInput,
    validateNumberInput,
    validateObjectIncludes,
    validatePositiveInt,
    validatePublicationId,
    validateQuery,
    validateStringArrayInput,
    validateStringInput,
    validateUserOrUsergroupId,
    validateVisualSettings,
} from "../../validation";
import {
    validateApprovalStatus,
    validateBinder,
    validateBinderFilter,
    validateChunkApprovalFilter,
    validateCollectionElementKind,
    validateDocumentCollectionFilter,
    validateDocumentPublicationAndCollectionFilter,
    validateFindBinderStatusesQueryParams,
    validateGetReaderItemContextOptions,
    validateItemOwnership,
    validateReaderFeedbackConfig,
    validateThumbnail
} from "./validation";
import { BindersRepositoryServiceContract } from "./contract";
import { validateTTSVoiceOptions } from "../../accountservice/v1/validation";

export default function getRoutes(): { [name in keyof BindersRepositoryServiceContract]: AppRoute } {
    return {
        createOrUpdateFeedback: {
            description: "Create or update feedback for a given binder publication",
            path: "/feedback/:publicationId",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "publicationId", validateStringInput],
                [fromBody, "feedbackParams", validateFeedbackParams],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getMostRecentPublicationUserFeedback: {
            description: "Get most recent logged-in user's feedback for a given binder publication",
            path: "/feedback/:publicationId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "publicationId", validatePublicationId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getBinderFeedbacks: {
            description: "List all feedbacks for a given binder",
            path: "/feedbacks/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        exportBinderFeedbacks: {
            description: "Export as JSON/CSV all feedbacks for a given binder",
            path: "/feedbacks/:binderId/export",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        searchBindersAndCollections: {
            description: "Search for Binders and Collections given a querystring",
            path: "/binders-collections-search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "query", validateQuery],
                [fromBody, "options", validateItemSearchOptions],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        searchPublicationsAndCollections: {
            description: "Search for Publications and Collections given a querystring",
            path: "/publications-collections-search",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "query", validateQuery],
                [fromBody, "options", validateItemSearchOptions],
                [fromBody, "domain", validateDomain],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getBinder: {
            description: "Retrieve a binder by its id",
            path: "/binders/:binderId/:options?",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "binderId", validateBinderId]],
            successStatus: HTTPStatusCode.OK
        },
        extendChunks: {
            description: "Extend a binder with additional chunks",
            path: "/extend-chunks",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "additionalChunks", c => validateNumberArrayInput(c, "additionalChunks")],
                [fromBody, "translated", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findBindersBackend: {
            description: "Retrieve binders with matching properties, from the backend (doesn't require user in request)",
            path: "/binderfind-backend",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateBinderFilter],
                [fromBody, "options", validateBindersSearchResultOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findBinderIdsByAccount: {
            description: "Retrieve binders ids by accountId, from the backend (doesn't require user in request)",
            path: "/binderidsfind-backend",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findItems: {
            description: "Retrieve all binders and collections with matching properties, from backend",
            path: "/items",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateBinderFilter],
                [fromBody, "options", validateBindersSearchResultOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findItemsForReader: {
            description: "Reader endpoint to retrieve all binders and collections with matching properties",
            path: "/findItemsForReader",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateBinderFilter],
                [fromBody, "filter", validateIncludesAccountFilterKeys],
                [fromBody, "options", validateItemSearchOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findItemsForEditor: {
            description: "Editor endpoint to retrieve all binders and collections with matching properties",
            path: "/findItemsForEditor",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateBinderFilter],
                [fromBody, "filter", validateIncludesAccountFilterKeys],
                [fromBody, "options", validateItemSearchOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getSoftDeletedItems: {
            description: "Retrieve all soft deleted items fro user and scope collection",
            path: "/softdeleteditems",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "options", validateItemSearchOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        findPublicationsAndCollections: {
            description: "Retrieve all publications and collections with matching properties",
            path: "/pubcols",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateDocumentPublicationAndCollectionFilter],
                [fromBody, "options", validateBindersSearchResultOptions],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getCollectionElementsWithInfo: {
            description: "Retrieve items within a given collection, including info about the languages being used",
            path: "/colElementsWithInfo",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "collectionId", validateCollectionId],
                [fromBody, "domain", validateDomain],
                [fromBody, "options", validateCollectionElementsWithInfoOptions],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createBinderInCollection: {
            description: "Create a new binder in a given collection",
            path: "/createBinderInCollection",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binder", validateBinder],
                [fromBody, "collectionId", validateCollectionId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK,
        },
        createBinderBackend: {
            description: "Create a new binder from the backend",
            path: "/from-backend/binders",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        duplicateBinder: {
            description: "Duplicate an already created binder",
            path: "/binders/duplicate",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        duplicateCollection: {
            description: "Duplicate an already created collection",
            path: "/collections/duplicate",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        updateBinder: {
            description: "Update the give binder",
            path: "/binders/:binderId",
            verb: HTTPVerb.PUT,
            validationRules: [[fromParams, "binderId", validateBinderId]],
            successStatus: HTTPStatusCode.OK
        },
        deleteBinder: {
            description: "Delete the binder with the provided id",
            path: "/binders/:binderId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        publish: {
            description: "Create or update a publication",
            path: "/publications/:binderId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "languages", c => validateStringArrayInput(c, "languages")]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        findPublications: {
            description: "Find publications for given binderId, using given filter",
            path: "/publicationfind/:binderId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "filter", validateBinderFilter]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findPublicationsBackend: {
            description: "Find publications matching the given filter",
            path: "/publicationfind-backend",
            verb: HTTPVerb.POST,
            validationRules: [[fromBody, "filter", validateBinderFilter]],
            successStatus: HTTPStatusCode.OK
        },
        unpublish: {
            description: "Unpublish the given languages",
            path: "/publications/:binderId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "languages", c => validateStringArrayInput(c, "languages")]
            ],
            successStatus: HTTPStatusCode.OK
        },
        setPublicationsShowInOverview: {
            description: "Set showInOverview flag of all active publications of given binder id",
            path: "/publications/:binderId/showInOverview",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "showInOverview", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updatePublicationsLanguages: {
            description: "Change the priority and master language for publications for given binder",
            path: "/publications/:binderId/changePriority",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getPublication: {
            description: "Retrieve a publication given its id",
            path: "/publications/:publicationId/:options?",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "publicationId", validateStringInput]],
            successStatus: HTTPStatusCode.OK
        },
        getCollectionInfo: {
            description: "Retrieve info for a collection and its children",
            path: "/collections/info/:collectionId",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "collectionId", validateDocumentCollectionId]],
            successStatus: HTTPStatusCode.OK
        },
        getCollectionsElements: {
            description: "Retrieve collections elements",
            path: "/collections/get-elements",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "colIds", validateArrayInput("collectionIds", validateDocumentCollectionId)],
                [fromBody, "recursive", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getChildCollectionSummaries: {
            description: "Retrieve additional info for given collection ids",
            path: "/collections/childcols-summaries",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "collectionIds", validateArrayInput("collectionIds", validateDocumentCollectionId)],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        createCollectionInCollection: {
            description: "Create a new collection in a given collection",
            path: "/createCollectionInCollection",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "collectionId", validateCollectionId],
                [fromBody, "title", validateStringInput],
                [fromBody, "languageCode", validateLanguageCode],
                [fromBody, "thumbnail", validateThumbnail]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        createCollectionBackend: {
            description: "Create a new collection from the backend",
            path: "/from-backend/collections",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "title", validateStringInput],
                [fromBody, "languageCode", validateLanguageCode],
                [fromBody, "thumbnail", validateThumbnail],
                [fromBody, "domainCollectionId", validateDocumentCollectionId]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        createRootCollection: {
            description: "Creates a root collection for an account",
            path: "/rootcollections",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "accountName", validateStringInput]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        updateCollectionIsHidden: {
            description: "Update the collection isHidden property",
            path: "/collections/:collectionId/is-hidden",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "isHidden", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateCollectionThumbnail: {
            description: "Update the collection thumbnail",
            path: "/collections/:collectionId/thumbnail",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "thumbnail", validateThumbnail]
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeCollectionThumbnail: {
            description: "Remove the collection thumbnail and takes IGetCollectionQueryOptions to allow returning ancestor thumbnails (and cdniffying) if available",
            path: "/collections/:collectionId/removeThumbnail",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateCollectionShowInOverview: {
            description: "Update the collection showInOverview flag",
            path: "/collections/:collectionId/showInOverview",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "showInOverview", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        saveCollectionTitle: {
            description: "Save the title for the given language",
            path: "/collections/:collectionId/titles/:languageCode",
            verb: HTTPVerb.PUT,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromParams, "languageCode", validateLanguageCode],
                [fromBody, "title", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateLanguageOfCollectionTitle: {
            description: "Update language of a collection title",
            path: "/collections/titles/updateLang",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "collectionId", validateDocumentCollectionId],
                [fromBody, "currentLanguageCode", validateLanguageCode],
                [fromBody, "languageCode", validateLanguageCode],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeCollectionTitle: {
            description: "Remove the title for the given language",
            path: "/collections/:domain/:collectionId/titles/:languageCode",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "domain", validateStringInput],
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromParams, "languageCode", validateLanguageCode],
            ],
            successStatus: HTTPStatusCode.OK
        },
        addElementToCollection: {
            description: "Add an element to the given collection",
            path: "/collections/:collectionId/elements",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "kind", validateCollectionElementKind],
                [fromBody, "key", validateStringInput],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        removeElementFromCollection: {
            description: "Add an element to the given collection",
            path: "/collections/:collectionId/elements",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "kind", validateCollectionElementKind],
                [fromBody, "key", validateStringInput],
                [fromBody, "accountId", validateAccountId],
                [fromBody, "permanent", validateBoolean]

            ],
            successStatus: HTTPStatusCode.OK
        },
        changeElementPosition: {
            description: "Move an element to a new position in the collection",
            path: "/collections/:collectionId/elements",
            verb: HTTPVerb.PATCH,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "kind", validateCollectionElementKind],
                [fromBody, "key", validateStringInput],
                [fromBody, "newPosition", validatePositiveInt]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findCollections: {
            description: "Find a set of document collections, from backend",
            path: "/collectionfind",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateDocumentCollectionFilter],
                [fromBody, "options", validateBindersSearchResultOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findCollectionsFromClient: {
            description: "Find a set of document collections, from client",
            path: "/fromclient/collectionfind",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "filter", validateDocumentCollectionFilter],
                [fromBody, "filter", validateIncludesAccountFilterKeys],
                [fromBody, "options", validateBindersSearchResultOptions]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getCollection: {
            description: "Retrieve a collection by its id",
            path: "/collections/:collectionId",
            verb: HTTPVerb.GET,
            validationRules: [[fromParams, "collectionId", validateDocumentCollectionId]],
            successStatus: HTTPStatusCode.OK
        },
        getDocumentResourceDetails: {
            description: "Get the resource access related details for a document",
            path: "/resources/:documentId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getDocumentResourceDetailsArray: {
            description: "Get the resource access related details for many documents at once",
            path: "/resources",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        deleteCollection: {
            description: "Delete the collection with the provided id",
            path: "/collections/:collectionId",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
                [fromBody, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.NO_CONTENT
        },
        findReaderItemsWithInfo: {
            description: "Find all items that are viewable by you, with languages used info",
            path: "/readerItems/findWithInfo",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "options", validateItemSearchOptions],
                [fromBody, "filter", validateBinderFilter],
                [fromBody, "filter", candidate => validateObjectIncludes(candidate, "domain", "filter")],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getRootCollections: {
            description: "Get the root collections for given account ids",
            path: "/rootCollectionFind",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountIds", c => validateAccountIdArrayInput(c, "accountIds")],
            ],
            successStatus: HTTPStatusCode.OK
        },
        countAllPublicDocuments: {
            description: "Count all public binders in the given account",
            path: "/findPublicDocuments/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAncestors: {
            description: "Gets the ancestors for given item id",
            path: "/ancestors/:itemId",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getItemsAncestors: {
            description: "Gets the ancestors for given items ids",
            path: "/ancestors",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        translate: {
            description: "Translates a text between given languagecodes",
            path: "/translate",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "html", validateStringInput],
                [fromBody, "sourceLanguageCode", validateLanguageCode],
                [fromBody, "targetLanguageCode", validateLanguageCode],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getTranslationsAvailable: {
            description: "Find languages available to translate",
            path: "/translations-available/all",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getSupportedLanguagesByEngine: {
            description: "Find languages codes available to translate by engine",
            path: "/translations-available/byEngine",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        detectLanguage: {
            description: "Returns language code for given text",
            path: "/detect-language",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "html", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getAccountTotals: {
            description: "Get account total number of docs and collections",
            path: "/totals/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        getMostUsedLanguages: {
            description: "Get the most frequently used languages in all content of given account ID's, in order of frequency",
            path: "/mostusedlanguages",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountIds", validateAccountIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateChunkApprovals: {
            description: "Change the approvalStatus of all approvals matching given filter",
            path: "/multiupdate/chunk-approvals",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "filter", validateChunkApprovalFilter],
                [fromBody, "approvalStatus", validateApprovalStatus],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        approveChunk: {
            description: "Approve a chunk with chunkId from binderId",
            path: "/chunk-approvals",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "chunkId", validateStringInput],
                [fromBody, "chunkLastUpdate", validatePositiveInt],
                [fromBody, "languageCode", validateLanguageCode],
                [fromBody, "approval", validateApprovalStatus],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        fetchApprovalsForBinder: {
            description: "Fetch approvals for a binder with binderId",
            path: "/chunk-approvals/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        saveChecklistActivation: {
            description: "Save checklist config activation status.",
            path: "/checklistconfig",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "chunkId", validateStringInput],
                [fromBody, "isActive", validateBoolean],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getChecklistConfigs: {
            description: "Get checklists config for given binderId",
            path: "/checklistconfig/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getMultiChecklistConfigs: {
            description: "Get checklists config for the given binderIds",
            path: "/checklistconfig/multiget",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderIds", validateBinderIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getChecklistsProgress: {
            description: "Get checklists progress for given binderIds",
            path: "/checklistsprogress",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderIds", c => validateStringArrayInput(c, "binderId")],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getChecklistsActions: {
            description: "Get checklists actions for given binderIds",
            path: "/checklistsactions",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderOrCollectionIds", c => validateStringArrayInput(c, "binderOrCollectionIds")],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getChecklists: {
            description: "Get checklists for given binderId",
            path: "/checklists/:binderId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        togglePerformed: {
            description: "Change state of performed property in checklist object",
            path: "/checklist/:binderId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromBody, "id", validateStringInput],
                [fromBody, "performed", validateBoolean]
            ],
            successStatus: HTTPStatusCode.OK
        },
        invalidatePublicItemsForAccount: {
            description: "Invalidate cached public items count for given account",
            path: "/invalidatePublicItemCount",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getAccountAncestorTree: {
            description: "Get the ancestor tree of the account's root collection",
            path: "/ancestortree/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK,
        },
        getLanguageCodesUsedInCollection: {
            description: "Getting languages used inside collection subtree sorted by most used",
            path: "/collections/getLanguagesUsed/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "shouldAddPublicationPossibilities", validateBoolean],
            ],
            successStatus: HTTPStatusCode.OK,
        },
        recursivePublish: {
            description: "Publish all document under given collection id",
            path: "/recursive/publish/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        recursiveUnpublish: {
            description: "Unpublish all document under given collection id",
            path: "/recursive/unpublish/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        recursiveDelete: {
            description: "Unpublish all document under given collection id",
            path: "/recursive/delete/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        recursiveTranslate: {
            description: "Translate all document under given collection id",
            path: "/recursive/translate/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        validateRecursiveAction: {
            description: "Returns validation results for given collection id and action",
            path: "/recursive/validate/:collectionId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getCustomerMetricsCsv: {
            description: "Generates a customers metrics csv",
            path: "/customerMetrics",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getSingleCustomerMetricsCsv: {
            description: "Generates a customers metrics csv for a given customer",
            path: "/singleCustomerMetrics",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        generateTextToSpeech: {
            description: "Creates an audio file from the given text",
            path: "/tts/generate",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "paragraphs", c => validateStringArrayInput(c, "paragraphs")],
                [fromBody, "voiceOptions", validateTTSVoiceOptions]
            ],
            successStatus: HTTPStatusCode.CREATED
        },
        fetchTextToSpeechFile: {
            description: "Fetch an audio file from blob storage without CDN",
            path: "/tts/fetch/:identifier",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "identifier", validateStringInput]
            ],
            successStatus: HTTPStatusCode.OK
        },
        listAvailableTTSLanguages: {
            description: "Show a list of available languages for text to speech",
            path: "/tts/languages",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        recoverDeletedItem: {
            description: "Recovers a soft deleted collection or binder",
            path: "/binders/recover",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "itemId", validateBinderId],
                [fromBody, "newParentCollectionId", validateDocumentCollectionId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        purgeRecycleBins: {
            description: "Purge the recycle bins",
            path: "/recyclebin/purge",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        relabelBinderLanguage: {
            description: "Relabel a binder language to a different language code",
            path: "/relabelbinderlanguage",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
                [fromBody, "fromLanguageCode", validateLanguageCode],
                [fromBody, "toLanguageCode", validateLanguageCode],
            ],
            successStatus: HTTPStatusCode.OK
        },
        deleteAllForAccount: {
            description: "Delete everything related to the given account",
            path: "/accounts/:accountId/delete",
            verb: HTTPVerb.DELETE,
            validationRules: [
                [fromParams, "accountId", validateAccountId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        requestReview: {
            description: "Send a review notification to the relevant notification targets",
            path: "/binders/review",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderId", validateBinderId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getDescendantsMap: {
            description: "Get a map of all descendants for a given collection",
            path: "/descendants/:collectionId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "collectionId", validateDocumentCollectionId]
            ],
            successStatus: HTTPStatusCode.OK
        },
        findBindersStatuses: {
            description: "A summarized list of information about every binder user in request has view permissions to. Used in the public api",
            path: "/findBindersStatuses",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "options", validateFindBinderStatusesQueryParams]
            ],
            successStatus: HTTPStatusCode.OK
        },
        calculateBindersStatuses: {
            description: "Calculates the statuses of all binders in the given account",
            path: "/calculateBindersStatuses/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        summarizePublicationsForAccount: {
            description: "Returns a summarized list of all active publications in the given account",
            path: "/summarizePublicationsForAccount/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        summarizeDraftsForAccount: {
            description: "Returns a summarized list of all drafts in the given account",
            path: "/summarizeDraftsForAccount/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getOwnershipForItems: {
            description: "Returns the ownership models for requested items (binder or collection)",
            path: "/getOwnershipForItems",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemIds", validateArrayInput("itemIds", validateItemId)],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        setOwnershipForItem: {
            description: "Updates the ownership model for an item (binder or collection)",
            path: "/setOwnershipForItem",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemId", validateItemId],
                [fromBody, "ownership", validateItemOwnership],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        removeOwnerIdFromItemOwnershipForAccount: {
            description: "Removes the passed in owner id from any item's ownership in an account",
            path: "/removeOwnerIdFromItemOwnershipForAccount",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "ownerId", validateUserOrUsergroupId],
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getItemAndAncestorsReaderFeedbackConfigs: {
            description: "Resolves the reader feedback configs for an item and its ancestors",
            path: "/getItemAndAncestorsReaderFeedbackConfigs",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemId", validateItemId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getReaderFeedbackConfigForItems: {
            description: "Returns the reader feedback config of given items",
            path: "/getReaderFeedbackConfigForItems",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemIds", validateItemIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateReaderFeedbackConfig: {
            description: "Update reader feedback config (comments/rating) on given item",
            path: "/updateReaderFeedbackConfig",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemId", validateStringInput],
                [fromBody, "config", validateReaderFeedbackConfig],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getFeedbacks: {
            description: "Find all feedbacks given a filter",
            path: "/getFeedbacks",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getReaderItemContext: {
            description: "Get the item context for the reader, consisting of documentAncestors, feedbackConfig",
            path: "/getReaderItemContext",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "itemId", validateItemId],
                [fromBody, "options", validateGetReaderItemContextOptions, "optional"],
                [fromQuery, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        clearLastModifiedInfo: {
            description: "Removes lastModifiedDate and lastModifiedBy for binder with provided id",
            path: "/clearLastModifiedInfo",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
                [fromBody, "binderIds", validateBinderIds],
            ],
            successStatus: HTTPStatusCode.OK
        },
        updateChunkVisualSettings: {
            description: "Updates the setting for a visual located on the specified chunk and index",
            path: "/updateChunkVisualSettings",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "binderId", validateBinderId],
                [fromBody, "chunkIdx", validateNumberInput],
                [fromBody, "visualIdx", validateNumberInput],
                [fromBody, "visualSettings", validateVisualSettings],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getUserActivities: {
            description: "Fetches all the activities for the current user",
            path: "/getUserActivities",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        restoreElasticDoc: {
            description: "Restore a document directly into elastic (dev and staging only)",
            path: "/restoreElasticDoc",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromBody, "indexName", validateStringInput],
                [fromBody, "documentId", validateItemId],
            ],
            successStatus: HTTPStatusCode.OK
        }
    };
}
