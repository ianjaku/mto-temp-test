import { ITranslationParams, MTEngine } from "./engines/engine";
import { buildSortByGeneralOrderPref, buildSortByLanguagePairPref } from "./helpers";
import { mergeChunks, splitChunks } from "@binders/client/lib/parsers/htmlSplitter";
import { AzureEngine } from "./engines/azureEngine";
import { Config } from "@binders/client/lib/config/config";
import { DeeplEngine } from "./engines/deeplEngine";
import { GoogleEngine } from "./engines/googleEngine";
import { IEngineLanguage } from "./engines/types";
import { IMTAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { UnsupportedLanguageError } from "../model";
import { flatten } from "ramda";

export interface ISupportedEngineResult {
    engine: MTEngine;
    languageCodes: string[]; // optionally rewritten language codes in case the engine supports only the default version and not the dialec
}

export default class Translator {
    constructor(
        private engines: MTEngine[]
    ) { }

    /**
     * Returns a new Translator instance with sorted Engines based on the account settings
     */
    withPreferredEngine(
        sourceLanguageCode: string,
        targetLanguageCode: string,
        mtSettings: IMTAccountSettings = {},
    ): Translator {
        const { generalOrder, pairs } = mtSettings;
        const sortedEngines = this.engines
            .sort(buildSortByGeneralOrderPref(generalOrder))
            .sort(buildSortByLanguagePairPref(sourceLanguageCode, targetLanguageCode, pairs));
        return new Translator(sortedEngines);
    }

    private async maybeDetectLanguageCode(languageCode: string, html: string) {
        if (languageCode !== UNDEFINED_LANG) {
            return languageCode;
        }
        return this.detectLanguage(html);
    }

    async translate(
        content: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        isHTML = false,
        interfaceLanguage?: string
    ): Promise<string> {
        if (sourceLanguageCode === targetLanguageCode) {
            return content;
        }
        const sourceWithDetectedFallback = await this.maybeDetectLanguageCode(sourceLanguageCode, content);
        const { engine, languageCodes } = await this.selectSupportedEngine([sourceWithDetectedFallback, targetLanguageCode], interfaceLanguage);
        if (engine === null) {
            throw new UnsupportedLanguageError(targetLanguageCode);
        }
        const params: ITranslationParams = {
            content,
            isHTML,
            sourceLanguageCode: languageCodes[0],
            targetLanguageCode: languageCodes[1],
        };
        return this.translateWithEngine(engine, params);
    }

    /**
     * Tries to translate the passed in text from a source language to a target one.
     * Falls back to English if the desired target language is not supported.
     */
    async translateWithFallbackToEnglish(
        content: string,
        sourceLanguageCode: string,
        targetLanguageCode: string,
        isHTML = false,
        interfaceLanguage?: string
    ): Promise<string> {
        const isTargetLanguageSupported = await this.isLanguageSupported(targetLanguageCode);
        if (isTargetLanguageSupported) {
            return this.translate(content, sourceLanguageCode, targetLanguageCode, isHTML, interfaceLanguage);
        }
        return this.translate(content, sourceLanguageCode, "en", isHTML, interfaceLanguage);
    }

    async getSupportedLanguagesByEngine(skipCache = false): Promise<{ [engineType: string]: string[] }> {
        const supportedLanguages = {};
        await Promise.all(this.engines.map(async engine => {
            return engine.getSupportedLanguages(skipCache).then(languages => {
                supportedLanguages[engine.type] = languages.map(l => l.code);
            });
        }));
        return supportedLanguages;
    }

    async getSupportedLanguages(skipCache = false): Promise<IEngineLanguage[]> {
        const engineLanguages = await Promise.all(
            this.engines.map(
                e => e.getSupportedLanguages(skipCache)
            )
        );
        const allEngineLanguages = flatten(engineLanguages);
        return this.removeDuplicateLanguages(allEngineLanguages);
    }

    detectLanguage(content: string): Promise<string> {
        // We can probably make this more robust if needed by looping over the engines
        return this.engines[0].detectLanguage(content);
    }

    private removeDuplicateLanguages(languages: IEngineLanguage[]): IEngineLanguage[] {
        const languagesByCode = languages
            .reverse()
            .reduce<{ [lang: string]: IEngineLanguage }>((languages, engineLanguage) => (
                Object.assign(languages, { [engineLanguage.code]: engineLanguage })
            ), {})
        return Object.values(languagesByCode);
    }

    private async buildUnsupportedLanguageError(languageCodes: string[], interfaceLanguage?: string): Promise<UnsupportedLanguageError> {
        const unsupportedLanguages = [];
        for (const languageCode of languageCodes) {
            if (!(await this.isLanguageSupported(languageCode))) {
                unsupportedLanguages.push(languageCode);
            }
        }
        return new UnsupportedLanguageError(unsupportedLanguages, interfaceLanguage);
    }

    async isLanguageSupported(languageCode: string): Promise<boolean> {
        return this.engines.reduce(
            async (reduced, engine) => {
                const foundEngine = await reduced;
                if (foundEngine) {
                    return foundEngine;
                }
                const supportedCode = await engine.hasSupportFor(languageCode, false);
                return supportedCode !== false;
            },
            Promise.resolve(false)
        )
    }

    private async selectSupportedEngine(
        languageCodes: string[],
        interfaceLanguage?: string,
        strict = true
    ): Promise<ISupportedEngineResult> {
        for (const engine of this.engines) {
            const supportedLanguageCodes = await Promise.all(
                languageCodes.map(lc => engine.hasSupportFor(lc, strict))
            );
            if (!(supportedLanguageCodes.includes(false))) {
                return {
                    languageCodes: supportedLanguageCodes as string[],
                    engine
                }
            }
        }
        if (strict) {
            // When strict fails, try again but non strict
            return this.selectSupportedEngine(languageCodes, interfaceLanguage, false);
        }
        throw (await this.buildUnsupportedLanguageError(languageCodes, interfaceLanguage));
    }

    private async withCharLimit(
        params: ITranslationParams,
        limit: number,
        target: (params: ITranslationParams) => Promise<string>
    ): Promise<string> {
        if (!params.isHTML) return target(params);
        if (params.content.length < limit) return target(params);
        const chunks = splitChunks(params.content, { maxChunkSize: limit - 1000 });
        const results = await Promise.all(
            chunks.map(c => {
                const chunkParams: ITranslationParams = Object.assign(params, { content: c });
                return Promise.resolve(target(chunkParams))
            })
        );
        return mergeChunks(results);
    }

    private async translateWithEngine(
        engine: MTEngine,
        params: ITranslationParams
    ): Promise<string> {
        return await this.withCharLimit(params, engine.getCharLimit(), (chunkParams) => (
            engine.translate(chunkParams)
        ));
    }

    getEngines(): MTEngine[] {
        return this.engines;
    }

    static async fromConfig(config: Config): Promise<Translator> {
        try {
            return new Translator([
                AzureEngine.fromConfig(config),
                GoogleEngine.fromConfig(config),
                DeeplEngine.fromConfig(config),
            ]);
        } catch (err) {
            return Promise.reject(err);
        }
    }
}
