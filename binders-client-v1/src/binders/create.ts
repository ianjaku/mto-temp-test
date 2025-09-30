import { Binder } from "../clients/repositoryservice/v3/contract";
import { InvalidArgument } from "../util/errors";
import UUID from "../util/uuid";
import { isAfter } from "date-fns";
import { satisfies } from "semver";
import { validateBinder } from "../clients/repositoryservice/v3/validation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputData = Record<string, any>;

export const constructV042Binder = (inputData: InputData): Binder => {
    inputData._isV010Compatible = satisfies(inputData.bindersVersion, ">= 0.1.0");
    inputData._isV020Compatible = satisfies(inputData.bindersVersion, ">= 0.2.0");
    inputData._isV030Compatible = satisfies(inputData.bindersVersion, ">= 0.3.0");
    inputData._isV040Compatible = satisfies(inputData.bindersVersion, ">= 0.4.0");
    inputData._isV041Compatible = satisfies(inputData.bindersVersion, ">= 0.4.1");
    inputData._isV042Compatible = satisfies(inputData.bindersVersion, ">= 0.4.2");
    const data = {
        bindersVersion: "0.4.2",
        storedVersion: inputData.bindersVersion,
        accountId: inputData.accountId,
        ancestorIds: inputData.ancestorIds,
        id: inputData.id,
        globalStyle: v020Binder$globalStyle(inputData),
        authors: v010Binder$authors(inputData),
        languages: v010Binder$languages(inputData),
        links: v010Binder$links(inputData),
        modules: v040Binder$modules(inputData),
        thumbnail: v041Binder$thumbnail(inputData),
        showInOverview: inputData.showInOverview,
        hasPublications: inputData.hasPublications,
        isInstance: inputData.isInstance,
        binderLog: v042Binder$binderLog(inputData),
        lastModified: inputData.lastModified,
        lastModifiedBy: inputData.lastModifiedBy,
        lastModifiedByName: inputData.lastModifiedByName,
        deletionTime: inputData.deletionTime,
        deletedById: inputData.deletedById,
        deletedGroupCollectionId: inputData.deletedGroupCollectionId,
        authorIds: inputData.authorIds || [],
        created: inputData.created,
    };
    const validationErrors = validateBinder(data);
    if (validationErrors.length > 0) {
        throw new InvalidArgument(validationErrors.join("\n"));
    }
    return data;
}

export const constructV040Binder = (inputData: InputData): Binder => {
    inputData._isV010Compatible = satisfies(inputData.bindersVersion, ">= 0.1.0");
    inputData._isV020Compatible = satisfies(inputData.bindersVersion, ">= 0.2.0");
    inputData._isV030Compatible = satisfies(inputData.bindersVersion, ">= 0.3.0");
    inputData._isV040Compatible = satisfies(inputData.bindersVersion, ">= 0.4.0");
    const data = {
        bindersVersion: "0.4.0",
        accountId: inputData.accountId,
        ancestorIds: inputData.ancestorIds,
        id: inputData.id,
        globalStyle: v020Binder$globalStyle(inputData),
        authors: v010Binder$authors(inputData),
        authorIds: inputData.authorIds || [],
        languages: v010Binder$languages(inputData),
        links: v010Binder$links(inputData),
        modules: v040Binder$modules(inputData),
        thumbnail: v010Binder$thumbnail(inputData)
    };
    const validationErrors = validateBinder(data);
    if (validationErrors.length > 0) {
        throw new InvalidArgument(validationErrors.join("\n"));
    }
    return data;
};


function v040Binder$modules(inputData: InputData) {
    if (inputData._isV040Compatible) {
        return inputData.modules;
    } else {
        return {
            meta: v010Binder$modules$meta(inputData),
            text: v010Binder$modules$text(inputData),
            images: v040Binder$modules$images(inputData)
        };
    }
}

function v040Binder$modules$images(inputData: InputData) {
    if (inputData._isV040Compatible) {
        return inputData.modules.images;
    } else {
        return {
            chunked: Object.keys(inputData.modules.meta).reduce((arr, val) => {
                if (inputData.modules.meta[val].type !== "images") {
                    return arr;
                }
                const v040ImageChunks = [];
                const key = inputData.modules.meta[val].key;
                for (const chunked of inputData.modules.images.chunked.filter(img => img.key === key)) {
                    for (const urlArray of chunked.chunks) {
                        const imageObjectArray = [];
                        for (const url of urlArray) {
                            imageObjectArray.push({
                                url,
                                fitBehaviour: "fit",
                                bgColor: "transparent",
                                audioEnabled: false,
                            });
                        }
                        v040ImageChunks.push(imageObjectArray);
                    }
                }
                arr.push({
                    key,
                    chunks: v040ImageChunks
                });
                return arr;
            }, [])
        };
    }
}

function v020Binder$globalStyle(inputData: InputData) {
    if (inputData._isV020Compatible) {
        return inputData.globalStyle;
    } else {
        return undefined;
    }
}

function v010Binder$thumbnail(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.thumbnail;
    } else {
        return {
            medium: inputData.moduleData.i1[0][0]
        };
    }
}
function v041Binder$thumbnail(inputData: InputData) {
    if (inputData._isV041Compatible) {
        return inputData.thumbnail;
    } else {
        return {
            medium: inputData.thumbnail.medium,
            fitBehaviour: "fit",
            bgColor: "transparent"
        };
    }
}

function v042Binder$binderLog(inputData: InputData) {
    if (inputData._isV042Compatible) {
        return inputData.binderLog;
    }

    const chunked = inputData?.modules?.text?.chunked;
    let chunkCount = Math.max(...chunked.map((c: { chunks: unknown[] }) => c.chunks.length));
    if (chunkCount <= 0) chunkCount = 1;
    
    const now = Date.now();

    const binderLogs = [];
    for (let i = 0; i < chunkCount; i++) {
        binderLogs.push({
            createdAt: now,
            position: i,
            updatedAt: now,
            uuid: UUID.random().toString(),
            targetId: [],
        })
    }
    return { current: binderLogs };
}

function v010Binder$authors(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.authors;
    } else {
        return Object.keys(inputData.authors).map(title => ({
            title,
            name: inputData.authors[title],
            nameRaw: inputData.authors[title]
        }));
    }
}

function v010Binder$languages(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.languages;
    } else {
        return Object.keys(inputData.moduleMeta).reduce((arr, val) => {
            if (inputData.moduleMeta[val].type !== "text") {
                return arr;
            }

            arr.push({
                iso639_1: null,
                modules: [val],
                storyTitle: inputData.title,
                storyTitleRaw: inputData.title,
                isMaster: inputData.isMaster
            });

            return arr;
        }, []);
    }
}

function v010Binder$links(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.links;
    } else {
        return {
            "index-pairs": Object.keys(inputData.moduleLinks).map(key => inputData.moduleLinks[key].modules)
        };
    }
}

function v010Binder$modules$meta(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.modules.meta;
    } else {
        return Object.keys(inputData.moduleMeta).map(moduleKey => {
            const moduleMeta = inputData.moduleMeta[moduleKey];
            return {
                key: moduleKey,
                type: moduleMeta.type,
                format: "chunked",
                markup: moduleMeta.type === "images" ? "url" : "none",
                iso639_1: null,
                caption: moduleMeta.summary
            };
        });
    }
}

function v010Binder$modules$text(inputData: InputData) {
    if (inputData._isV010Compatible) {
        return inputData.modules.text;
    } else {
        return {
            chunked: Object.keys(inputData.moduleMeta).reduce((arr, val) => {
                if (inputData.moduleMeta[val].type !== "text") {
                    return arr;
                }

                arr.push({
                    key: val,
                    chunks: inputData.moduleData[val]
                });

                return arr;
            }, [])
        };
    }
}

export function createNewBinder(accountId: string, isoCode: string, title: string, editorState?: unknown): Binder {
    editorState = editorState ? editorState : "";
    const baseBinder = {
        bindersVersion: "0.4.0",
        authors: [],
        accountId,
        languages: [
            {
                iso639_1: isoCode,
                modules: ["t1"],
                storyTitle: title,
                storyTitleRaw: title
            }
        ],
        links: { "index-pairs": [["t1", "i1"]] },
        modules: {
            meta: [
                {
                    key: "t1",
                    type: "text",
                    format: "chunked",
                    markup: "richtext",
                    caption: "Original text",
                    iso639_1: isoCode
                },
                {
                    key: "i1",
                    type: "images",
                    format: "chunked",
                    markup: "object",
                    caption: "Original illustrations"
                }
            ],
            text: { chunked: [{ key: "t1", chunks: [[]], editorStates: [editorState] }] },
            images: { chunked: [{ key: "i1", chunks: [[]] }] }
        },
        thumbnail: {
            medium: "http://placehold.it/300x300",
            fitBehaviour: "fit",
            bgColor: "transparent"
        }
    };

    return constructV040Binder(baseBinder);
}

export function shallowCloneBinder(binder: Binder, excludeKeys: string[] = []): Binder {
    const newBinder = {};
    for (const k in binder) {
        if (k.startsWith("_") || excludeKeys.indexOf(k) !== -1) {
            continue;
        }
        newBinder[k] = binder[k];
    }
    return newBinder as Binder;
}


export interface LastEditInfo {
    lastEdit: Date | string,
    lastEditBy: string;
    lastEditByUserId: string
}

export function getLastEditInfo(binder: Binder): LastEditInfo {
    const { lastEdit, lastEditBy, lastEditByUserId } = binder.modules.meta.reduce((reduced, metaModule) => {
        const {
            lastEdit: lastEditSoFar,
        } = reduced;
        const { lastModifiedDate } = metaModule;
        if (!lastEditSoFar || (lastModifiedDate && isAfter(new Date(lastModifiedDate), new Date(lastEditSoFar)))) {
            return {
                lastEdit: metaModule.lastModifiedDate,
                lastEditBy: metaModule.lastModifiedByName || metaModule.lastModifiedBy,
                lastEditByUserId: metaModule.lastModifiedBy
            }
        }
        return reduced;
    }, {
        lastEdit: undefined,
        lastEditBy: undefined,
        lastEditByUserId: undefined
    });
    const lastEditWasFoundInMeta = !!lastEdit && !!lastEditBy;
    const {
        lastModified: binderLastModifiedDate,
        lastModifiedBy: binderLastModifiedById,
        lastModifiedByName: binderLastModifiedByName,
    } = binder;
    const useBinderLvlProps = !lastEditWasFoundInMeta || (binderLastModifiedDate && isAfter(new Date(binderLastModifiedDate), new Date(lastEdit)));
    if (useBinderLvlProps) {
        return {
            lastEdit: binderLastModifiedDate,
            lastEditBy: binderLastModifiedByName || binderLastModifiedById,
            lastEditByUserId: binderLastModifiedById
        };
    }
    return {
        lastEdit, lastEditBy, lastEditByUserId
    };
}
