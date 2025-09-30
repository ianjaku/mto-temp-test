import * as request from "superagent";
import { ITranslationParams, MTEngine } from "./engine";
import { Config } from "@binders/client/lib/config/config";
import { IEngineLanguage } from "./types";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Maybe } from "@binders/client/lib/monad";
export const TRANSLATE_TIMEOUT = "Timeout in post to deepl translator API"
const DEEPL_API_CHAR_LIMIT = 100000; // deeply only limits in request body size (128 KiB)

type TranslateResponseType = { translations: [{ detected_source_language: string, text: string }] };
type SupportedLanguageResponseType = [{ language: string, name: string }];

export class DeeplEngine extends MTEngine {

    public type = MTEngineType.Deepl;

    constructor(
        private host: string,
        private subscriptionKey: string,
        config: Config,
    ) {
        super(MTEngineType.Deepl, config);
    }

    getCharLimit(): number {
        return DEEPL_API_CHAR_LIMIT;
    }

    async translate({ content, sourceLanguageCode, targetLanguageCode }: ITranslationParams): Promise<string> {
        this.logger.debug(`[Deepl] Translating ${content} from ${sourceLanguageCode} to ${targetLanguageCode}`, "translating");
        const processedContent = this.escapeSpecialCharacters(content);
        const source_lang = !sourceLanguageCode || sourceLanguageCode.toLowerCase() === "xx" ?
            undefined :
            sourceLanguageCode;
        const target_lang = targetLanguageCode;
        try {
            const result = await this.requestDeepl<TranslateResponseType>(
                "POST",
                "/translate",
                {
                    text: processedContent,
                    ...(source_lang ? { source_lang } : {} ),
                    target_lang,
                }
            );
            const translation = ((result.translations) || []).pop();
            return this.unescapeSpecialCharacters(translation?.text);
        } catch (err) {
            this.logger.error(err, "translation");
            throw err;
        }
    }

    protected async fetchSupportedLanguages(): Promise<IEngineLanguage[]> {
        try {
            const response = await this.requestDeepl<SupportedLanguageResponseType>(
                "POST",
                "/languages",
            );
            return response.map<IEngineLanguage>(lang => ({
                code: lang.language.toLowerCase(),
                name: lang.name,
                nativeName: lang.name,
                dir: "ltr" // We don't receive reading direction information from Deepl.
            }));
        } catch (err) {
            this.logger.logException(err, "translation languages");
            return [];
        }
    }

    async detectLanguage(content: string): Promise<string> {
        try {
            const result = await this.requestDeepl<TranslateResponseType>(
                "POST",
                "/translate",
                {
                    text: content,
                    target_lang: "en",
                }
            );
            const translation = ((result.translations) || []).pop();
            const detectedLang = translation?.detected_source_language;
            return (detectedLang && detectedLang.toLowerCase()) || undefined;
        } catch (err) {
            this.logger.error(err, "translation");
            throw err;
        }
    }

    private requestDeepl<T>(method: "POST" | "GET", path: string, body: Record<string, unknown> = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            const url = `https://${this.host}${path}`;
            let requestObj = method === "POST" ? request.post(url) : request.get(url);
            requestObj = requestObj.send({
                ...body,
                tag_handling: "html",
                ignore_tags: "notranslate",
            });
            requestObj
                .set("Content-Type", "application/x-www-form-urlencoded")
                .set("Authorization", `DeepL-Auth-Key ${this.subscriptionKey}`)
                .then(
                    res => {
                        if (res?.text == null) {
                            resolve(null)
                        } else {
                            resolve(JSON.parse(res.text))
                        }
                    },
                    err => reject(err)
                )

        })
    }

    private escapeSpecialCharacters(text: string) {
        return text.replace(/([\u2200-\u22ff])/g, "<notranslate>$1</notranslate>");
    }

    private unescapeSpecialCharacters(text: string) {
        return text.replace(new RegExp("<notranslate>([^<]*)</notranslate>", "g"), "$1");
    }

    static fromConfig(config: Config): DeeplEngine {
        const translatorConfig = config.getObject("translator.deepl") as Maybe<{host: string, subscriptionKey: string}>;
        const { host, subscriptionKey } = translatorConfig.get();
        return new DeeplEngine(host, subscriptionKey, config);
    }
}
