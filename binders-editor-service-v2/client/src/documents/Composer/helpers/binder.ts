import Binder, { ImageModule, TextModule } from "@binders/client/lib/binders/custom/class";
import { IDocumentInfo, IModuleSet } from "../components/BinderLanguage/types";
import {
    extractBinderTitle,
    isSemanticallyEmptyJsonChunkSerialized,
    isSemanticallyEmptyTitle,
} from "../../helper";
import { thumbnailToVisual, toBinderVisual } from "../../../media/helper";
import { DATE_CHANGED_MARKER } from "@binders/client/lib/binders/defaults";
import { EditorState } from "draft-js";
import RTEState from "@binders/client/lib/draftjs/state";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { any } from "ramda";
import { stripHTML } from "@binders/client/lib/util/html";
import { update as updateBinder } from "@binders/client/lib/binders/custom/class";

const blankDocumentInfo = {
    moduleSets: [],
    titleModuleSet: { text: undefined, image: undefined },
    isEmptyDocument: true,
    documentHasVisuals: false,
    chunk1EqualsTitle: true,
    isTitleTextEmpty: true,
}

export interface CleanMarkerResult {
    result: Binder;
    updates: { [moduleKey: string]: string | Date };
}

export function maybeCleanMarkers(stateBinder: Binder, serverBinder: Binder): CleanMarkerResult | undefined {
    if (!stateBinder) {
        return undefined;
    }
    if (stateBinder.getModules().meta.some(m => m.lastModifiedDate === DATE_CHANGED_MARKER)) {
        const updates = {};
        const newMeta = stateBinder.getModules().meta.map(
            (stateMeta, i) => {
                const serverMeta = serverBinder.getModules().meta[i];
                if (stateMeta.lastModifiedDate === DATE_CHANGED_MARKER) {
                    updates[stateMeta.key] = serverMeta.lastModifiedDate;
                }
                return {
                    ...stateMeta,
                    lastModifiedDate: serverMeta.lastModifiedDate,
                    lastModifiedBy: serverMeta.lastModifiedBy,
                };
            }
        );
        const patch = {
            modules: {
                meta: {
                    $set: newMeta
                }
            }
        };
        return {
            result: updateBinder(stateBinder, () => [patch], false, true),
            updates,
        };
    }
    return {
        result: stateBinder,
        updates: {}
    };
}

export interface IChunkResult {
    hasText: boolean;
    hasVisuals: boolean;
}

function buildIsEmptyMap(binder: Binder): { [chunkIndex: number]: IChunkResult } {
    const { datasPerChunk, imageDatasPerChunk } = binder.getVisibleLanguages().reduce((reduced, language) => {
        const { datasPerChunk, imageDatasPerChunk } = reduced;
        const keys = binder.getModulePairByLanguage(language.iso639_1);
        const [textsModules, imagesModules] = keys.map(key => binder.getModuleByKey(key));
        textsModules.data.forEach((dataArr, i) => {
            datasPerChunk[i] = [...(datasPerChunk[i] || []), dataArr];
        });
        imagesModules.data.forEach((data, i) => {
            imageDatasPerChunk[i] = [...(imageDatasPerChunk[i] || []), data];
        });
        return { datasPerChunk, imageDatasPerChunk };
    }, { datasPerChunk: [], imageDatasPerChunk: [] });
    return Object.keys(datasPerChunk).reduce((reduced, chunkIndex) => {
        const mapIndex = parseInt(chunkIndex, 10);
        const allDataArrays: string[][] = datasPerChunk[chunkIndex] || [];
        const allImageDatas = <unknown[][]>imageDatasPerChunk[chunkIndex] || [];
        const hasVisuals = any((imageArr => !!imageArr.length), allImageDatas);
        return {
            ...reduced,
            [mapIndex]: {
                hasText: any(dataArray => stripHTML(dataArray.join("")).trim().length > 0, allDataArrays),
                hasVisuals,
            }
        };
    }, {});
}

function getTitleDetails(binder, languageCode: string) {
    const titleText = extractBinderTitle(binder, languageCode);
    const thumbnail = binder.thumbnail;
    return {
        titleText,
        thumbnail
    };
}

function moduleSetFromTitleDetails(titleDetails): IModuleSet {
    const { titleText, thumbnail } = titleDetails;
    return {
        text: {
            data: [[titleText]],
        },
        image: {
            images: [thumbnailToVisual(thumbnail)],
        },
        isEmpty: isSemanticallyEmptyTitle(titleText),
    };
}

export function buildDocumentInfo(binder: Binder, languageCode: string): IDocumentInfo {
    if (!languageCode) {
        return {
            moduleSets: [],
            titleModuleSet: undefined,
            isEmptyDocument: undefined,
            documentHasVisuals: undefined,
            chunk1EqualsTitle: undefined,
            isTitleTextEmpty: undefined,
        };
    }

    const titleDetails = getTitleDetails(binder, languageCode);
    const titleModuleSet = moduleSetFromTitleDetails(titleDetails);
    const isTitleTextEmpty = isSemanticallyEmptyTitle(titleDetails.titleText);

    const keys = binder.getModulePairByLanguage(languageCode);
    if (keys.length === 0) {
        return blankDocumentInfo;
    }
    const [textsModules, imagesModules] = keys.map(key => binder.getModuleByKey(key)) as [TextModule, ImageModule];
    const isEmptyAcrossLanguagesMap = buildIsEmptyMap(binder);
    let isEmptyDocument = titleModuleSet.isEmpty;
    let documentHasVisuals: boolean;

    // There's something fishy with the types here, the `moduleSets` type
    // won't match the expected `IDocumentInfo["moduleSets"]` one, needs investigation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleSets: any = textsModules.data.map((_text, index) => {
        const { hasText, hasVisuals } = isEmptyAcrossLanguagesMap[index];
        const isEmptyAcrossLanguages = !hasText && !hasVisuals;
        if (isEmptyDocument) {
            isEmptyDocument = isEmptyAcrossLanguages;
        }
        documentHasVisuals = !!documentHasVisuals || !!hasVisuals;
        return {
            text: {
                data: textsModules.data[index],
                json: textsModules.json ? textsModules.json[index] : undefined,
                meta: textsModules.meta,
                state: textsModules.states[index],
            },
            image: {
                meta: imagesModules.meta,
                images: [
                    ...imagesModules.data[index],
                ].map(toBinderVisual),
            },
            uuid: textsModules.uuids[index],
            isEmpty: stripHTML(textsModules.data[index].join("")).trim().length === 0,
            isEmptyAcrossLanguages,
        };
    });

    const chunk1Text = stripHTML(textsModules.data[0].join("")).replace(/&nbsp;/g, " ");
    const chunk1EqualsTitle = titleDetails.titleText === chunk1Text;
    return {
        moduleSets,
        titleModuleSet,
        isEmptyDocument,
        isTitleTextEmpty,
        documentHasVisuals,
        chunk1EqualsTitle
    };
}

export function hasEmptyChunks(binder: Binder, languageCode: string): boolean {
    const [textKey] = binder.getModulePairByLanguage(languageCode);
    const textModule = binder.getModuleByKey(textKey) as TextModule;
    if (binder.hasJsonTextModules()) {
        return any(isSemanticallyEmptyJsonChunkSerialized, textModule.json);
    }
    return any(RTEState.isSemanticallyEmpty, textModule.states as unknown as readonly EditorState[]);
}

export function getBinderPrimaryLanguageCode(binder: Binder): string {
    const primaryLanguage = binder && binder.getFirstLanguage();
    return primaryLanguage ? primaryLanguage.iso639_1 : UNDEFINED_LANG;
}
