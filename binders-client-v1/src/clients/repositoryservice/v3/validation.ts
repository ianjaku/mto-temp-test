/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as t from "tcomb";
import {
    ApprovedStatus,
    Binder,
    BinderSummary,
    DocumentCollection,
    FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS,
    Item,
    Publication,
    PublicationSummary,
} from "./contract";
import { tcombValidate, validateLanguageCode, validationOk } from "../../validation";
import { TranslationKeys } from "../../../i18n/translations";
import i18next from "../../../i18n";

export const Pair = t.refinement(
    t.list(t.String),
    arr => arr.length === 2,
    "Pair (Array<String>[2])"
);

const ThumbnailStruct = t.struct({
    medium: t.String,
    fitBehaviour: t.enums.of(["fit", "crop"]),
    bgColor: t.String,
    rotation: t.maybe(t.enums.of(["0", "90", "180", "270"])),
    urlToken: t.maybe(t.String),
}, "Thumbnails");


export const Style = t.struct({
    font: t.struct({
        "size-hint": t.maybe(t.enums.of([
            "single-word",
            "child-novel",
            "novel"
        ])),
        "family": t.maybe(t.list(t.String)),
        "google-fonts": t.maybe(t.list(t.String)),
        "google-fonts-earlyaccess": t.maybe(t.list(t.String))
    })
}, "Style");

const ImageStructure = t.struct({
    id: t.maybe(t.String),
    url: t.String,
    fitBehaviour: t.enums.of(["fit", "crop"]),
    bgColor: t.String,
    languageCodes: t.maybe(t.list(t.String)),
    inUse: t.maybe(t.Boolean),
    rotation: t.maybe(t.enums.of(["0", "90", "180", "270"])),
    urlToken: t.maybe(t.String),
    audioEnabled: t.maybe(t.Boolean),
    autoPlay: t.maybe(t.Boolean),
    startTimeMs: t.maybe(t.Number), // Defaults to 0
    endTimeMs: t.maybe(t.Number) // Defaults to video length
}, "ImageStructure");

const ImageOrUrl = t.union([
    ImageStructure,
    t.String
], "ImageOrUrl");

ImageOrUrl.dispatch = function(x) {
    return x.url ? ImageStructure : t.String;
};

const bindersVersions = ["0.2.0", "0.3.0", "0.4.0", "0.4.1", "0.4.2"];

export const DocumentCollectionStructure = t.struct({
    id: t.maybe(t.String),
    accountId: t.String,
    titles: t.list(t.Any),
    thumbnail: t.Any,
    elements: t.list(t.Any),
    deletedElements: t.maybe(t.list(t.Any)),
    isRootCollection: t.Boolean,
    hasPublications: t.maybe(t.Boolean),
    showInOverview: t.maybe(t.Boolean),
    domainCollectionId: t.maybe(t.String),
    isHidden: t.maybe(t.Boolean),
    isInstance: t.maybe(t.Boolean),
    totalPublicDocuments: t.maybe(t.Integer),
    deletionTime: t.maybe(t.union([t.String, t.Date])),
});

export function isDocumentCollection(item: unknown): item is DocumentCollection {
    return tcombValidate(item, DocumentCollectionStructure).length === 0;
}

export const BinderStructure: t.Struct<Binder> = t.struct({
    bindersVersion: t.enums.of(bindersVersions),
    storedVersion: t.maybe(t.enums.of(bindersVersions)),
    id: t.maybe(t.String),
    contentVersion: t.maybe(t.Number),
    globalStyle: t.maybe(Style),
    accountId: t.maybe(t.String),
    ancestorIds: t.maybe(t.list(t.String)),
    authors: t.list(t.struct({
        title: t.String,
        name: t.String,
        nameRaw: t.String
    }, "Author")),
    authorIds: t.list(t.String),
    isDirty: t.maybe(t.Boolean),
    languages: t.list(t.struct({
        iso639_1: t.String,
        modules: t.list(t.String),
        storyTitle: t.String,
        storyTitleRaw: t.String,
        priority: t.maybe(t.Number)
    }, "Language")),
    links: t.struct({
        "index-pairs": t.list(Pair)
    }, "Links"),
    modules: t.struct({
        meta: t.list(t.struct({
            key: t.String,
            type: t.enums.of([
                "text",
                "images"
            ]),
            format: t.enums.of([
                "chunked"
            ]),
            markup: t.enums.of([
                "none",
                "url",
                "richtext",
                "object"
            ]),
            caption: t.String,
            style: t.maybe(Style),
            iso639_1: t.maybe(t.String),
            lastModifiedDate: t.maybe(t.union([t.String, t.Date])),
            lastModifiedBy: t.maybe(t.String),
            lastModifiedByName: t.maybe(t.String),
            isDeleted: t.maybe(t.Boolean),
            pdfExportOptions: t.maybe(t.struct({
                renderTitlePage: t.maybe(t.Boolean),
                renderOnlyFirstCarrouselItem: t.maybe(t.Boolean),
                fontsSize: t.maybe(t.struct({
                    h1: t.Number,
                    h2: t.Number,
                    h3: t.Number,
                    paragraph: t.Number,
                    dateLabel: t.Number,
                    li: t.Number,
                })),
                translatedChunks: t.maybe(t.list(t.String)),
                languageCode: t.maybe(t.String),
            })),
        }, "ModuleMeta")),
        text: t.struct({
            chunked: t.list(t.struct({
                key: t.String,
                chunks: t.list(t.list(t.String)),
                json: t.maybe(t.list(t.String)),
                editorStates: t.list(t.Any)
            }, "ChunkedTextModule"))
        }, "TextModules"),
        images: t.struct({
            chunked: t.list(t.struct({
                key: t.String,
                chunks: t.list(t.list(ImageOrUrl))
            }, "ChunkedImagesModule"))
        }, "ImageModules")
    }, "Modules"),
    thumbnail: ThumbnailStruct,
    showInOverview: t.maybe(t.Boolean),
    hasPublications: t.maybe(t.Boolean),
    isInstance: t.maybe(t.Boolean),
    binderLog: t.maybe(t.struct({
        current: t.maybe(t.list(t.struct({
            createdAt: t.Number,
            position: t.Number,
            updatedAt: t.Number,
            uuid: t.String,
            targetId: t.list(t.String),
        }))),
    })),
    lastModified: t.maybe(t.union([t.String, t.Date])),
    lastModifiedBy: t.maybe(t.String),
    lastModifiedByName: t.maybe(t.String),
    deletionTime: t.maybe(t.union([t.String, t.Date])),
    deletedById: t.maybe(t.String),
    deletedGroupCollectionId: t.maybe(t.String),
    created: t.maybe(t.union([t.String, t.Date])),
}, "Binder v0.4.0");

export function isBinder(item: unknown): item is Binder {
    return tcombValidate(item, BinderStructure).length === 0;
}

export const PublicationStructure = t.struct({
    binderId: t.String,
    accountId: t.String,
    domainCollectionId: t.String,
    bindersVersion: t.String,
    thumbnail: ThumbnailStruct,
    language: t.struct({
        iso639_1: t.String,
        modules: t.list(t.String),
        storyTitle: t.String,
        storyTitleRaw: t.String,
        priority: t.maybe(t.Number)
    }, "Language"),
    links: t.struct({
        "index-pairs": t.list(Pair)
    }, "Links"),
    modules: t.struct({
        meta: t.list(t.struct({
            key: t.String,
            type: t.enums.of([
                "text",
                "images"
            ]),
            format: t.enums.of([
                "chunked"
            ]),
            markup: t.enums.of([
                "none",
                "url",
                "richtext",
                "object"
            ]),
            caption: t.String,
            style: t.maybe(Style),
            iso639_1: t.maybe(t.String),
            lastModifiedDate: t.maybe(t.union([t.String, t.Date])),
            isDeleted: t.maybe(t.Boolean)
        }, "ModuleMeta")),
        text: t.struct({
            chunked: t.list(t.struct({
                key: t.String,
                chunks: t.list(t.list(t.String)),
                json: t.maybe(t.list(t.String)),
                editorStates: t.list(t.Any)
            }, "ChunkedTextModule"))
        }, "TextModules"),
        images: t.struct({
            chunked: t.list(t.struct({
                key: t.String,
                chunks: t.list(t.list(ImageOrUrl))
            }, "ChunkedImagesModule"))
        }, "ImageModules")
    }, "Modules"),
    publicationDate: t.union([t.String, t.Date]),
    publishedBy: t.maybe(t.String),
    isActive: t.maybe(t.Boolean),
    isMaster: t.maybe(t.Boolean),
    unpublishDate: t.maybe(t.union([t.String, t.Date])),
}, "Publication");

const validateModulesEqualChunkCount = (candidate: Binder | Publication, expectedKind?: string) => {
    const {
        text: { chunked: textModules },
        images: { chunked: imageModules },
    } = candidate.modules;
    const imageModule = imageModules[0];
    const chunkCount = imageModule.chunks.length;
    for (const textModule of textModules) {
        const textModuleIsCorrect = textModule.chunks.length === chunkCount;
        const jsonIsCorrect = !textModule.json || textModule.json.length === chunkCount;
        if (!textModuleIsCorrect || !jsonIsCorrect) {
            return [
                i18next.t(
                    TranslationKeys.DocManagement_DiffInModulesCountError,
                    { kind: expectedKind || i18next.t(TranslationKeys.DocManagement_BinderOrPublication) }
                )
            ];
        }
    }

    return validationOk;
}

export function validateBinder(binderCandidate: unknown): string[] {
    const tCombResults = tcombValidate(binderCandidate, BinderStructure);
    return tCombResults.concat(validateModulesEqualChunkCount(binderCandidate as Binder, "binder"));
}

export const validatePublication: (publicationCandidate: unknown) => string[] = (publicationCandidate) => {
    const tCombResults = tcombValidate(publicationCandidate, PublicationStructure);
    return tCombResults.concat(validateModulesEqualChunkCount(publicationCandidate as Publication, "publication"));
}

export const DocumentCollectionFilterStruct = t.struct({
    ids: t.maybe(t.list(t.String)),
    binderId: t.maybe(t.String),
    binderids: t.maybe(t.list(t.String)),
    languageCodes: t.maybe(t.list(t.String)),
    rootCollections: t.maybe(t.list(t.String)),
    itemIds: t.maybe(t.list(t.String)),
    domain: t.maybe(t.String)
}, "CollectionFilter");

export const DocumentPublicationAndCollectionFilterStruct = t.struct({
    ids: t.maybe(t.list(t.String)),
    binderIds: t.maybe(t.list(t.String)),
    summary: t.maybe(t.Boolean),
    preferredLanguages: t.maybe(t.list(t.String)),
    domain: t.maybe(t.String)
});

export const BinderFilterStruct = t.struct({
    binderId: t.maybe(t.String),
    binderIds: t.maybe(t.list(t.String)),
    summary: t.maybe(t.Boolean),
    languageCodes: t.maybe(t.list(t.String)),
    preferredLanguages: t.maybe(t.list(t.String)),
    domain: t.maybe(t.String)
});

const ApprovalStatus = t.enums.of([
    ApprovedStatus.APPROVED,
    ApprovedStatus.REJECTED,
    ApprovedStatus.UNKNOWN,
]);

const ChunkApprovalFilter = t.struct({
    approvalStatus: t.maybe(ApprovalStatus),
    chunkIndices: t.list(t.Number),
    chunkLanguageCodes: t.list(
        t.irreducible("Valid Language", (c: string) => validateLanguageCode(c).length === 0)
    ),
});

const InheritedItemOwnership = t.struct({
    type: t.String,
}, "InheritedItemOwnership");
const OverriddenItemOwnership = t.struct({
    type: t.String,
    ids: t.list(t.String)
}, "OverriddenItemOwnership");
const ItemOwnership = t.union([InheritedItemOwnership, OverriddenItemOwnership], "ItemOwnership");
ItemOwnership.dispatch = (ownership) => {
    if (ownership?.type === "inherited") {
        return InheritedItemOwnership;
    } else if (ownership?.type === "overridden") {
        return OverriddenItemOwnership;
    } else {
        return t.fail;
    }
}

const FindBindersStatusesQueryParams = t.struct({
    maxResults: t.maybe(t.union([
        t.refinement(t.Number, v => v > 0 && v <= FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS),
        t.refinement(t.String, str => {
            if (isNaN(parseInt(str))) return false;
            const nr = parseInt(str);
            return nr > 0 && nr <= FIND_BINDERS_STATUSES_MAX_ALLOWED_RESULTS;
        })
    ])),
    minCreationDate: t.maybe(t.refinement(t.String, v => {
        if (isNaN(new Date(v).getTime())) return false;
        if (new Date().getTime() < new Date(v).getTime()) return false;
        return true;
    })),
    format: t.maybe(t.String)
});

const ReaderFeedbackConfigStruct = t.struct({
    itemId: t.maybe(t.String),
    readerCommentsEnabled: t.maybe(t.Boolean),
    readerRatingEnabled: t.maybe(t.Boolean),
    readConfirmationEnabled: t.maybe(t.Boolean),
});

const GetReaderItemContextOptionsStruct = t.struct({
    skipReaderFeedbackConfig: t.maybe(t.Boolean),
});

export function validateItemOwnership(candidate: unknown): string[] {
    return tcombValidate(candidate, ItemOwnership);
}

export function validateFindBinderStatusesQueryParams(candidate: unknown): string[] {
    return tcombValidate(candidate, FindBindersStatusesQueryParams);
}

export function validateBinderFilter(filterCandidate): string[] {
    return tcombValidate(filterCandidate, BinderFilterStruct);
}

export function validateDocumentCollectionFilter(filterCandidate): string[] {
    return tcombValidate(filterCandidate, DocumentCollectionFilterStruct);
}

export function validateDocumentPublicationAndCollectionFilter(filterCandidate): string[] {
    return tcombValidate(filterCandidate, DocumentPublicationAndCollectionFilterStruct);
}

export function validateCollectionElementKind(kindCandidate): string[] {
    return tcombValidate(kindCandidate, t.enums.of(["document", "collection"]));
}

export function validateThumbnail(thumbnail): string[] {
    return tcombValidate(thumbnail, ThumbnailStruct);
}

export function validateApprovalStatus(candidate): string[] {
    return tcombValidate(candidate, ApprovalStatus);
}

export function validateChunkApprovalFilter(candidate): string[] {
    return tcombValidate(candidate, ChunkApprovalFilter);
}

export function validateReaderFeedbackConfig(candidate): string[] {
    return tcombValidate(candidate, ReaderFeedbackConfigStruct);
}

export function validateGetReaderItemContextOptions(candidate): string[] {
    return tcombValidate(candidate, GetReaderItemContextOptionsStruct);
}

export function isBinderSummaryItem(item: Item): item is BinderSummary {
    return "modules" in item && "languages" in item && !("binderLog" in item);
}

export function isBinderItem(item: Item): item is Binder {
    return "modules" in item && "languages" in item && "binderLog" in item;
}

export function isCollectionItem(item: Item): item is DocumentCollection {
    return "elements" in item;
}

export function isPublicationItem(item: Item): item is Publication {
    return "modules" in item && "language" in item && "links" in item;
}

export function isPublicationSummaryItem(item: Item): item is PublicationSummary {
    return "modules" in item && "language" in item && !("links" in item);
}
