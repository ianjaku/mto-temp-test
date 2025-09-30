import * as Immutable from "immutable";
import {
    Author,
    Binder,
    BinderLinks,
    BinderModules,
    BindersChunkedImageModule,
    BindersChunkedTextModule,
    BindersModuleMeta,
    IThumbnail,
    Language 
} from "../clients/repositoryservice/v3/contract";
import { List, Map } from "immutable";
import { InvalidOperation } from "../util/errors";
import RTEState from "../draftjs/state";
import { TranslationKeys } from "../i18n/translations";
import { constructV040Binder } from "./create";
import i18next from "../i18n";

export class ImmutableBinder implements Binder {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(private _plainBinder: Binder, private _immutableProps: Map<string, any>) {
        if (typeof _immutableProps === "undefined" && typeof _plainBinder === "undefined") {
            throw new InvalidOperation(i18next.t(TranslationKeys.Edit_ImmutableBinderPropKeyError));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get immutableProps(): Map<string, any> {
        if (typeof this._immutableProps === "undefined") {
            this._immutableProps = Immutable.fromJS(this._plainBinder);
        }

        return this._immutableProps;
    }

    private get plainBinder(): Binder {
        if (typeof this._plainBinder === "undefined") {
            this._plainBinder = this._immutableProps.toJS();
        }
        return this._plainBinder;
    }

    get bindersVersion(): string {
        return this.plainBinder.bindersVersion;
    }

    get thumbnail(): IThumbnail {
        return this.plainBinder.thumbnail;
    }

    get authors(): Array<Author> {
        return this.plainBinder.authors;
    }

    get authorIds(): Array<string> {
        return this.plainBinder.authorIds;
    }

    get ancestorIds(): string[] {
        return this.plainBinder.ancestorIds;
    }

    get languages(): Array<Language> {
        return this.plainBinder.languages;
    }

    get links(): BinderLinks {
        return this.plainBinder.links;
    }

    get modules(): BinderModules {
        return this.plainBinder.modules;
    }

    replaceTextModule(module: BindersChunkedTextModule): ImmutableBinder {
        return this.replaceListElement(
            ["modules", "text", "chunked"],
            mod => mod.get("key") == module.key,
            i18next.t(TranslationKeys.Edit_ReplaceModuleKeyNotFoundError, {key: module.key}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => Map(<any>module)
        ).updateLastModified(module.key);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    replaceTextChunk(moduleKey: string, chunkIndex: number, newText: string) {
        return this.replaceListElement(
            ["modules", "text", "chunked"],
            mod => mod.get("key") == moduleKey,
            i18next.t(TranslationKeys.Edit_ReplaceModuleKeyNotFoundError, {key: moduleKey}),
            module => {
                const updatedChunks = module.get("chunks").set(chunkIndex, [newText]);
                return module.set("chunks", updatedChunks);
            }
        ).updateLastModified(moduleKey);
    }

    private insertListElement<T>(keyPath: string[], index: number, value: T) {
        const currentList = this.immutableProps.getIn(keyPath);
        if (currentList === undefined) {
            throw new InvalidOperation(i18next.t(TranslationKeys.Edit_NoListWithKeyError, {key: keyPath.join(".")}));
        }
        if (currentList.size < index) {
            throw new InvalidOperation(i18next.t(TranslationKeys.Edit_InvalidOffsetCantInsert));
        }
        const updatedList = currentList.insert(index, value);
        const updatedProps = this.immutableProps.setIn(keyPath, updatedList);
        return new ImmutableBinder(undefined, updatedProps);
    }

    private replaceListElement<T>(
        keyPath: string[],
        predicate: (T) => boolean,
        messageNotFound: string,
        update: (T) => T
    ): ImmutableBinder {
        const currentList = this.immutableProps.getIn(keyPath);
        if (currentList === undefined) {
            throw new InvalidOperation(i18next.t(TranslationKeys.Edit_NoListWithKeyError, {key: keyPath.join(".")}));
        }
        const indexToUpdate = currentList.findIndex(predicate);
        if (indexToUpdate === -1) {
            throw new InvalidOperation(messageNotFound);
        }
        const updatedList = currentList.update(indexToUpdate, update);
        const updatedProps = this.immutableProps.setIn(keyPath, updatedList);
        return new ImmutableBinder(undefined, updatedProps);
    }

    replaceLanguage(language: Language): ImmutableBinder {
        return this.replaceListElement(
            ["languages"],
            lang => lang.get("iso639_1") == language.iso639_1,
            i18next.t(TranslationKeys.Edit_ReplaceLanguageError, {language: language.iso639_1}),
            () => language
        );
    }

    replaceMetaModule(module: BindersModuleMeta): ImmutableBinder {
        return this.replaceListElement(
            ["modules", "meta"],
            metaMod => metaMod.get("key") == module.key,
            i18next.t(TranslationKeys.Edit_ReplaceMetaModuleError, {key: module.key}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => Map(<any>module)
        );
    }

    insertMetaModule(module: BindersModuleMeta): ImmutableBinder {
        return this.insertListElement(
            ["modules", "meta"],
            this.immutableProps.get("modules").get("meta").size,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Map(<any>module)
        );
    }

    replaceImageModule(module: BindersChunkedImageModule): ImmutableBinder {
        return this.replaceListElement(
            ["modules", "images", "chunked"],
            imageMod => imageMod.get("key") == module.key,
            i18next.t(TranslationKeys.Edit_ReplaceImageModuleError, {key: module.key}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => Map(<any>module)
        ).updateLastModified(module.key);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    insertChunk(chunkIndex: number) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return this.modules.meta.reduce((reduced, metaModule, index) => {
            const withUpdatedList = reduced.replaceListElement(
                ["modules", metaModule.type, metaModule.format],
                mod => mod.get("key") == metaModule.key,
                i18next.t(TranslationKeys.Edit_NoModuleWithKey, {key: metaModule.key, type: metaModule.type, format: metaModule.format}),
                module => {
                    const currentChunks = module.get("chunks");
                    if (currentChunks.size < chunkIndex) {
                        throw new InvalidOperation(
                            i18next.t(TranslationKeys.Edit_AddNewChunkError, {key: metaModule.key, index: chunkIndex})
                        );
                    }
                    const updatedChunks = currentChunks.insert(chunkIndex, List(List()));
                    const currentEditorStates = module.get("editorStates");
                    const updatedModule = module.set("chunks", updatedChunks);
                    if (currentEditorStates) {
                        return updatedModule.set(
                            "editorStates",
                            currentEditorStates.insert(chunkIndex, RTEState.createEmpty())
                        );
                    } else {
                        return updatedModule;
                    }
                }
            );
            return withUpdatedList.updateLastModified(metaModule.key);
        }, this as ImmutableBinder);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateLastModified(moduleKey): ImmutableBinder {
        return this.replaceListElement(
            ["modules", "meta"],
            module => {
                return module.get("key") == moduleKey;
            },
            i18next.t(TranslationKeys.Edit_TimestampUpdateError, {key: moduleKey}),
            mod => mod.set("lastModifiedDate", new Date())
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    insertImage(moduleKey: string, chunkIndex: number, imageIndex: number, url: string) {
        return this.replaceListElement(
            ["modules", "images", "chunked"],
            imageMod => imageMod.get("key") == moduleKey,
            i18next.t(TranslationKeys.Edit_InsertImageError, {key: moduleKey}),
            module => {
                const currentChunks = module.get("chunks");
                const currentImages = currentChunks.get(chunkIndex);
                if (currentImages === undefined) {
                    throw new InvalidOperation(i18next.t(TranslationKeys.Edit_InsertImageNoChunkError, {key: moduleKey, index: chunkIndex}));
                }
                if (currentImages.size < imageIndex) {
                    throw new InvalidOperation(i18next.t(TranslationKeys.Edit_InsertImageWrongIndexError, {index: imageIndex}));
                }
                const updatedImages = currentImages.insert(imageIndex, url);
                const updatedChunks = currentChunks.set(chunkIndex, updatedImages);
                return module.set("chunks", updatedChunks);
            }
        ).updateLastModified(moduleKey);
    }

    insertTextModule(languageCode: string, title: string): ImmutableBinder {
        // new meta module
        const currentModules = this.immutableProps.get("modules");
        const currentMetaModules = currentModules.get("meta");
        const moduleKey = "t" + currentMetaModules.size;
        const currentTextMarkup = currentMetaModules.find(mod => mod.get("type") == "text").markup;
        const currentTextModules = currentModules.get("text").get("chunked");
        const firstCurrentTextModule = currentTextModules.get(0);
        const metaModule = Map({
            key: moduleKey,
            type: "text",
            format: "chunked",
            markup: currentTextMarkup ? currentTextMarkup : "richtext",
            caption: `${languageCode} text`,
            iso639_1: languageCode,
            lastModifiedDate: new Date()
        });

        // new text module
        const chunkCount = firstCurrentTextModule.get("chunks").size;
        const textModule = Map({
            key: moduleKey,
            chunks: Immutable.Repeat(List(), chunkCount).toList(),
            editorStates: Immutable.Repeat(RTEState.createEmpty(), chunkCount).toList()
        });

        // new language
        const currentLanguages = this.immutableProps.get("languages");
        const binderLanguage = Map({
            iso639_1: languageCode,
            modules: [moduleKey],
            storyTitle: title,
            storyTitleRaw: title
        });

        const updatedMetaModules = currentMetaModules.push(metaModule);
        const updatedTextModules = currentTextModules.push(textModule);
        const updatedLanguages = currentLanguages.push(binderLanguage);
        const updatedProps = this.immutableProps
            .setIn(["modules", "meta"], updatedMetaModules)
            .setIn(["modules", "text", "chunked"], updatedTextModules)
            .set("languages", updatedLanguages);

        return new ImmutableBinder(undefined, updatedProps);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static fromMutable(binder: Binder) {
        return new ImmutableBinder(binder, undefined);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    toJS() {
        return constructV040Binder(this.plainBinder);
    }
}
