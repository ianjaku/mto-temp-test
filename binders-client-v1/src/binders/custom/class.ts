import {
    BinderLinks,
    BinderModules,
    BindersChunkedImageModule,
    BindersChunkedTextModule,
    BindersModuleMeta,
    Binder as IBinder,
    IBinderLog,
    IBinderVisual,
    IChunkCurrentPositionLog,
    Language
} from "../../clients/repositoryservice/v3/contract";
import {
    DATE_CHANGED_MARKER,
    DEFAULT_COVER_IMAGE,
    DEFAULT_FIT_BEHAVIOUR,
    DEFAULT_THUMBNAIL_BG_COLOR
} from "../defaults";
import { ILanguageInfo, getLanguageInfo } from "../../languages/helper";
import Thumbnail, { withParsedThumbnail } from "../../clients/repositoryservice/v3/Thumbnail";
import { UpdatePatch, update as updateStruct } from "tcomb";
import { any, clone, curry, find, findIndex, times } from "ramda";
import { extractIdFromUrl, isPlaceholderVisual } from "../../clients/imageservice/v1/visuals";
import { Application } from "../../clients/trackingservice/v1/contract";
import { BinderStructure as BinderModel } from "../../clients/repositoryservice/v3/validation";
import { EMPTY_JSON_DOCUMENT } from "../../util/tiptap";
import RTEState from "../../draftjs/state";
import { TranslationKeys as TK } from "../../i18n/translations";
import { constructV042Binder } from "../create";
import i18n from "../../i18n";
import { withParsedImageModule } from "../../clients/repositoryservice/v3/BinderVisual";

export const create = (rawInput: Record<string, unknown>): Binder => {
    return new Binder(constructV042Binder(rawInput));
};

function logNoDateChangeMarkerFound(updatePatches: UpdatePatch | UpdatePatch[]) {
    // dynamic import prevents ref to window object (in tokenstore) in node context
    import("../../util/clientErrors").then(({ logClientError }) => {
        const msg = `Detected a patch without DATE_CHANGED_MARKER where it was expected. lastModifiedDate will not be updated which could result in MT-3445. patches: ${JSON.stringify(updatePatches)}`;
        logClientError(Application.EDITOR, msg);
        // eslint-disable-next-line no-console
        console.error(msg);
    });
}

/*
    @param skipDateChangeMarkerCheck -
        true if we don't expect this update to change the lastModifiedDate (cleanMarkers update)
        if false and lastModifiedDate is not updated, log client error (context: MT-3445)
*/
export function update(
    instance: Binder,
    patchFn: (binder: Binder) => UpdatePatch[] | UpdatePatch,
    bumpContentVersion: boolean,
    skipDateChangeMarkerCheck = false,
): Binder {
    let newContentVersion = instance.getContentVersion() === undefined ? 0 : instance.getContentVersion();
    if (bumpContentVersion) {
        newContentVersion++;
    }
    const updatePatches = patchFn(instance);
    const patches: UpdatePatch[] = Array.isArray(updatePatches) ? updatePatches : [updatePatches];
    const updatedStructure = patches.reduce((reduced, patch) => {
        return updateStruct(reduced, patch);
    }, instance.toJSON());

    if (!skipDateChangeMarkerCheck) {
        const dateChangeMarkerDetected = updatedStructure["modules"].meta.some(metaModule => metaModule.lastModifiedDate === DATE_CHANGED_MARKER);
        if (!dateChangeMarkerDetected) {
            logNoDateChangeMarkerFound(updatePatches);
        }
    }

    updatedStructure["contentVersion"] = newContentVersion;
    return new Binder(updatedStructure as IBinder);

}

const multiUpdate = (
    instance: Binder,
    patchFns: Array<(binder: Binder) => UpdatePatch[]>,
    bumpContentVersion: boolean
): Binder => {
    return patchFns.reduce(
        (reduced, patch) => update(reduced, patch, bumpContentVersion),
        instance,
    );
};

// curried versions are needed as update function to useStateBinder/setStateBinder hook to use fresh binder instance when perform update operation
export const curriedUpdateBinder = curry((patch, bumpContentVersion, instance) => update(instance, patch, bumpContentVersion));

export const curriedMultiUpdate = curry((patches, bumpContentVersion, instance) => multiUpdate(instance, patches, bumpContentVersion));

export type LanguageWithInfo = Language & ILanguageInfo;

export type TextModule = {
    meta: BindersModuleMeta;
    data: BindersChunkedTextModule["chunks"];
    json: BindersChunkedTextModule["json"];
    states: BindersChunkedTextModule["editorStates"];
    uuids: IChunkCurrentPositionLog["uuid"][];
};
export type ImageModule = {
    meta: BindersModuleMeta;
    data: BindersChunkedImageModule["chunks"];
};
type ModuleMapByKey = Record<BindersModuleMeta["key"], TextModule | ImageModule>;

export default class Binder {

    public id: string;

    private _caches: {
        languagesWithInfo: LanguageWithInfo[],
        languageByIso: Record<LanguageWithInfo["iso639_1"], LanguageWithInfo>,
        moduleByKey: ModuleMapByKey,
        moduleStyles: unknown,
    };
    private readonly _struct: IBinder;

    private accountId: string;
    private binderLog: IBinderLog;
    private contentVersion: number;
    /**
     * @deprecated
     */
    private deletedById;
    /**
     * @deprecated
     */
    private deletedGroupCollectionId;
    private deletionTime: Date | null | undefined;
    /**
     * @deprecated
     */
    private globalStyle;
    private languages: Language[];
    /**
     * @deprecated
     */
    private lastModified;
    /**
     * @deprecated
     */
    private lastModifiedBy;
    /**
     * @deprecated
     */
    private lastModifiedByName;
    private links: BinderLinks;
    private modules: BinderModules;
    private thumbnail: Thumbnail;

    constructor(rawInput: IBinder) {
        // Validate using struct.
        // ! All properties not defined in the struct will be dropped
        const parsed = withParsedImageModule<IBinder>(withParsedThumbnail<IBinder>(BinderModel(rawInput)));
        this._struct = parsed;

        //Copy all properties from the validated struct.
        //Note: all nested structures copied through this are read-only through Object.freeze(...).
        //However scalar values will be copied by value, so we need to freeze those ourselves.
        for (const key in this._struct) {
            // eslint-disable-next-line no-prototype-builtins
            if (this._struct.hasOwnProperty(key)) {
                this[key] = this._struct[key];
            }
        }

        //Make sure we have the empty cache set up.
        this._caches = {
            languagesWithInfo: null,
            languageByIso: null,
            moduleByKey: null,
            moduleStyles: {}
        };

        // From here on, all except the caches are read-only.
        // eslint-disable-next-line
        if (process.env.NODE_ENV !== "production") {
            Object.freeze(this);
        }
    }

    findLanguageByIsoCode(isoCode: string): Language | undefined {
        return this.languages.find(language => language.iso639_1 === isoCode);
    }

    getAccountId() {
        return this.accountId;
    }

    getAllEditorStatesByLanguageIndex(langIdx: number): string[] {
        return this.modules.text?.chunked?.[langIdx]?.editorStates ?? [];
    }

    getAllTextChunks(moduleKey: string) {
        if (!moduleKey) {
            return [];
        }
        const module = this.modules.text.chunked.find(({ key }) => key === moduleKey);
        return module?.chunks ?? [];
    }

    getAuthorIds() {
        return this._struct.authorIds;
    }

    getBinderId() {
        return this._struct.id
    }

    getBinderLog() {
        return this.binderLog;
    }

    getChunkCurrentPositionLog(chunkId: string): IChunkCurrentPositionLog | undefined {
        return this.getBinderLog()?.current?.find(positionLog => positionLog.uuid === chunkId);
    }

    getContentVersion() {
        return this.contentVersion;
    }

    getDeletionTime() {
        return this._struct.deletionTime;
    }

    getDeletedById() {
        return this._struct.deletedById;
    }

    getFirstLanguage(excludeCode?: string): LanguageWithInfo | null {
        const allLanguages = this.getLanguagesWithInfoSortedByPriority();
        if (!excludeCode) {
            return allLanguages[0];
        }
        for (let i = 0; i < allLanguages.length; i++) {
            if (allLanguages[i].iso639_1 !== excludeCode) {
                return allLanguages[i];
            }
        }
        return null;
    }

    getFirstTextModuleKeyByLanguageIndex(langIdx: number): string | null {
        return this.languages[langIdx]?.modules?.at(0);
    }

    getImagesModule(moduleKey: string) {
        return this.modules.images.chunked.find(module => module.key === moduleKey);
    }

    getImagesModuleIndex(moduleKey: string) {
        return this.modules.images.chunked.findIndex(module => module.key === moduleKey);
    }

    getImagesModuleKey(): string {
        return `i${this.modules.meta.filter(m => m.key.startsWith("i")).length}`;
    }

    getLanguageByIso(isoCode: string): LanguageWithInfo {
        if (!this._caches.languageByIso) {
            buildLanguageByIsoMapping.call(this);
        }
        return this._caches.languageByIso[isoCode];
    }

    getLanguageIndex(isoCode: string): number {
        return this.languages.findIndex(language => language.iso639_1 === isoCode);
    }

    getLanguageIsoByIndex(index: number): string {
        return this.languages[index].iso639_1;
    }

    getLanguages(): Language[] {
        return this.languages;
    }

    getLanguagesWithInfo(): LanguageWithInfo[] {
        if (!this._caches.languagesWithInfo) {
            buildLanguagesWithInfoArray.call(this);
        }
        return this._caches.languagesWithInfo;
    }

    getLanguagesWithInfoSortedByPriority(): LanguageWithInfo[] {
        if (!this._caches.languagesWithInfo) {
            buildLanguagesWithInfoArray.call(this);
        }
        return this._caches.languagesWithInfo.sort(({ priority: p1 }, { priority: p2 }) => p1 - p2);
    }

    //This returns an array of matching indexes per type of link.
    //Useful for creating patches.
    getLinkIndexesContainingKey(key: string): { [linkType: string]: number[] } {
        return {
            "index-pairs": this.links["index-pairs"].reduce(
                (acc, pair, index: number) => pair.indexOf(key) !== -1 ? acc.concat(index) : acc, [] as number[]
            )
        };
    }

    getMetaModuleByIndex(index: number) {
        return this.modules.meta[index];
    }

    getMetaModuleIndexByLanguageCode(languageCode: string): number {
        return this.modules.meta.findIndex(m => m.type === "text" && m.iso639_1 === languageCode);
    }

    getMetaModulesLength() {
        return this.modules.meta.length;
    }

    getModuleByKey(moduleKey: string) {
        if (!this._caches.moduleByKey) {
            buildModuleByKeyMapping.call(this);
        }
        return this._caches.moduleByKey[moduleKey];
    }

    getModulePairByLanguage(isoCode: string): [string, string] | [] {
        const language = this.getLanguageByIso(isoCode);
        if (!language) {
            return [];
        }
        return find<[string, string]>(any(pairElement => pairElement === language.modules[0]), this.links["index-pairs"]);
    }

    getModules(): BinderModules {
        return this.modules;
    }

    getNextTextModuleKey(): string {
        return `t${this.modules.meta.length + 1}`;
    }

    getRawTextForLanguage(languageCode: string): string {
        const result: string[] = []
        const title = this.getTitle(languageCode)

        if (title) {
            result.push(title)
        }

        const moduleKey = this.modules.meta.find(({ iso639_1, type }) => iso639_1 === languageCode && type === "text")
        if (moduleKey && moduleKey.key) {
            const { chunks } = this.modules.text.chunked.find(({ key }) => key === moduleKey.key)
            const transformedChunks = chunks.reduce((acc, [chunk]) => {
                if (chunk) {
                    acc.push(chunk.replace(/(<([^>]+)>)/gi, "").trim())
                }
                return acc;
            }, [])
            return result.concat(transformedChunks).join(" ")
        }

        return result.join(" ")
    }

    getTextModuleByLanguageIndex(index: number): BindersChunkedTextModule {
        return this.modules.text?.chunked?.[index];
    }

    getTextModuleChunksByLanguageAndChunkIndex(langIdx: number, chunkIdx: number): string[] {
        return this.modules.text?.chunked?.[langIdx]?.chunks[chunkIdx];
    }

    getTextModuleEditorStateByLanguageAndChunkIndex(langIdx: number, chunkIdx: number): string {
        return this.modules.text?.chunked?.[langIdx]?.editorStates[chunkIdx];
    }

    getTextModuleIndex(moduleKey: string): number {
        return this.modules.text.chunked.findIndex(module => module.key === moduleKey);
    }

    getThumbnail(): Thumbnail {
        return this.thumbnail;
    }

    getThumbnailUrl() {
        return this.thumbnail.buildRenderUrl();
    }

    getTitle(isoCode: string): string | undefined {
        const language = this.getLanguageByIso(isoCode);
        return language && language.storyTitle;
    }

    getVisibleLanguages(): Omit<LanguageWithInfo, "direction">[] {
        return this.languages.filter(l => {
            const correspondingMetaModules = this.modules.meta.filter(m => {
                return m.iso639_1 === l.iso639_1;
            });
            return (!correspondingMetaModules[0]) || (correspondingMetaModules[0].isDeleted !== true);
        }).map(l => {
            const { name, nativeName } = getLanguageInfo(l.iso639_1);
            return { ...l, name, nativeName };
        }).sort(({ priority: p1 }, { priority: p2 }) => p1 - p2);
    }

    getVisualIds(moduleKey: string): string[] {
        const imageModule = this.getImagesModule(moduleKey);
        const visualIdsSet = imageModule.chunks.reduce((reduced, chunk) => {
            chunk.forEach(img => reduced.add(img.id));
            return reduced;
        }, new Set<string>());
        const thumbnailVisualId = isPlaceholderVisual(this.thumbnail.medium) ?
            [] :
            [extractIdFromUrl(this.thumbnail.medium)]
        return thumbnailVisualId.concat(Array.from(visualIdsSet));
    }

    getVisualIndices(moduleKey: string, visualToSearch: { id: string }): Record<string, Record<string, IBinderVisual[]>> {
        const indices: Record<string, Record<string, IBinderVisual[]>> = {};
        const imageModule = this.getImagesModule(moduleKey);
        const imageModuleIndex = this.getImagesModuleIndex(moduleKey);
        let chunkIndex = 0;
        indices[imageModuleIndex] =
            imageModule.chunks.reduce((reduced, chunk) => {
                const matchingVisuals: IBinderVisual[] = [];
                for (let i = 0; i < chunk.length; i++) {
                    if (chunk[i].url.indexOf(visualToSearch.id) >= 0) {
                        matchingVisuals[i] = chunk[i];
                    }
                }
                if (matchingVisuals.length > 0) {
                    reduced[chunkIndex] = matchingVisuals;
                }
                chunkIndex++;
                return reduced;
            }, {} as Record<string, IBinderVisual[]>);
        return indices;
    }

    getLastModified() {
        return this.lastModified;
    }

    getLastModifiedBy() {
        return this.lastModifiedBy;
    }

    isDeleted() {
        return !!this.deletionTime;
    }

    isRecursivelyDeleted() {
        return !!this._struct.deletedGroupCollectionId
    }

    isLanguageDeleted(languageCode: string): boolean {
        const currentMetaModule = this.getMetaModuleIndexByLanguageCode(languageCode);
        const target = this.getLanguageByIso(languageCode);
        return target == null && currentMetaModule != null && currentMetaModule >= 0;
    }

    setTextModuleChunk(langIdx: number, chunkIdx: number, chunk: string[], editorState: string): Binder {
        const binder = clone(this);
        const binderChunks = [...binder.modules.text.chunked[langIdx].chunks];
        binderChunks[chunkIdx] = chunk;
        binder.modules.text.chunked[langIdx].chunks = binderChunks;
        const newEditorStates = [...binder.modules.text.chunked[langIdx].editorStates];
        newEditorStates[chunkIdx] = editorState;
        binder.modules.text.chunked[langIdx].editorStates = newEditorStates;
        return binder;
    }

    replaceTextModuleChunks(langIdx: number, chunks: string[][], editorStates: string[]): Binder {
        const binder = clone(this);
        binder.modules.text.chunked[langIdx].chunks = chunks;
        binder.modules.text.chunked[langIdx].editorStates = editorStates;
        return binder;
    }

    // Implement toJSON, so values we don't use in the binder format don't show up.
    toJSON(writableStruct = false) {
        return writableStruct ?
            clone(this._struct) :
            this._struct;
    }

    updateMetaTimestamp(moduleKey: string) {
        const index = findIndex(module => module.key === moduleKey, <{ key: unknown }[]>this.modules.meta);
        const module = this.modules.meta[index];
        const updatedModule = updateStruct(module, { lastModifiedDate: { $set: DATE_CHANGED_MARKER } });
        // module.lastModifiedDate = new Date();
        return {
            index,
            module: updatedModule
        };
    }

    hasJsonTextModules() {
        return this.modules.text.chunked.some(m => m.json);
    }

}

/* Private methods */
function buildModuleByKeyMapping() {
    const moduleMap = {};

    //First find the metadata for each module.
    this.modules.meta.forEach((meta: BindersModuleMeta) =>
        moduleMap[meta.key] = {
            meta: meta,
            data: null
        }
    );

    //Now loop through the data to add to the modules.
    this.modules.text.chunked.forEach((textModuleData: BindersChunkedTextModule) => {
        if (!moduleMap[textModuleData.key]) {
            throw new Error(i18n.t(TK.Edit_BinderIntegrityNoMetaTextError, { key: textModuleData.key }));
        }
        moduleMap[textModuleData.key].data = textModuleData.chunks;
        moduleMap[textModuleData.key].json = textModuleData.json;
        moduleMap[textModuleData.key].states = textModuleData.editorStates;
        moduleMap[textModuleData.key].uuids = this.binderLog.current.map((c: IChunkCurrentPositionLog) => c.uuid);
    });

    this.modules.images.chunked.forEach((imagesModuleData: BindersChunkedImageModule) => {
        if (!moduleMap[imagesModuleData.key]) {
            throw new Error(i18n.t(TK.Edit_BinderIntegrityNoMetaImageError, { key: imagesModuleData.key }));
        }

        moduleMap[imagesModuleData.key].data = imagesModuleData.chunks;
    });

    this._caches.moduleByKey = moduleMap;
}

function buildLanguageByIsoMapping(): void {
    const languageMap: Record<LanguageWithInfo["iso639_1"], LanguageWithInfo> = {};
    this.getLanguagesWithInfo().forEach((language: LanguageWithInfo) => languageMap[language.iso639_1] = language);
    this._caches.languageByIso = languageMap;
}

function buildLanguagesWithInfoArray() {
    this._caches.languagesWithInfo = this.getVisibleLanguages().map((language: Omit<LanguageWithInfo, "direction">): LanguageWithInfo => ({
        ...getLanguageInfo(language.iso639_1),
        ...language
    }));
}

export const createNewBinder = (
    title: string,
    languageIsoCode: string,
    accountId: string,
    chunkCount = 1,
    shouldUseNewTextEditor = false,
): Binder => {
    const baseBinder = {
        bindersVersion: "0.3.0",
        authors: [],
        authorIds: [],
        accountId,
        languages: [
            {
                iso639_1: languageIsoCode,
                modules: ["t1"],
                storyTitle: title,
                storyTitleRaw: title,
                priority: 0
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
                    iso639_1: languageIsoCode
                },
                {
                    key: "i1",
                    type: "images",
                    format: "chunked",
                    markup: "url",
                    caption: "Original illustrations"
                }
            ],
            text: {
                chunked: [
                    {
                        key: "t1",
                        chunks: times<string[]>(() => [], chunkCount),
                        ...(shouldUseNewTextEditor ? { json: times<string>(() => EMPTY_JSON_DOCUMENT, chunkCount) } : {}),
                        editorStates: times(() => RTEState.createEmpty(), chunkCount),
                    }
                ]
            },
            images: {
                chunked: [
                    {
                        key: "i1",
                        chunks: times(() => [], chunkCount),
                    },
                ],
            },
        },
        thumbnail: {
            medium: DEFAULT_COVER_IMAGE,
            fitBehaviour: DEFAULT_FIT_BEHAVIOUR,
            bgColor: DEFAULT_THUMBNAIL_BG_COLOR
        }
    };
    return create(baseBinder);
};
