import * as request from "superagent";
import { CogtnitiveAPITimeout, UnsupportedLanguageError } from "../../model";
import { ITranslationParams, MTEngine, standardizeLanguageCode } from "./engine";
import { Config } from "@binders/client/lib/config/config";
import { IEngineLanguage } from "./types";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Maybe } from "@binders/client/lib/monad";

const FROM_UNSUPPORTED_LANG_ERROR_CODE = 400035;
const TO_UNSUPPORTED_LANG_ERROR_CODE = 400036;
const UNSUPPORTED_LANG_ERROR_CODES = [FROM_UNSUPPORTED_LANG_ERROR_CODE, TO_UNSUPPORTED_LANG_ERROR_CODE];
export const TRANSLATE_TIMEOUT = "Timeout in post to azure translator API"
const AZURE_API_CHAR_LIMIT = 5000;

export class AzureEngine extends MTEngine {

    public type = MTEngineType.Azure;

    constructor(
        private host: string,
        private subscriptionKey: string,
        config: Config,
    ) {
        super(MTEngineType.Azure, config);
    }

    getCharLimit(): number {
        return AZURE_API_CHAR_LIMIT;
    }

    async translate({ content, sourceLanguageCode, targetLanguageCode, isHTML }: ITranslationParams): Promise<string> {
        this.logger.debug(`[Azure] Translating ${content} from ${sourceLanguageCode} to ${targetLanguageCode}`, "translating");
        const fromQueryParam = !sourceLanguageCode || sourceLanguageCode.toLowerCase() === "xx" ?
            "" :
            `&from=${sourceLanguageCode}`;
        const path = `/translate?api-version=3.0${isHTML ? "&textType=html" : ""}${fromQueryParam}&to=${targetLanguageCode}`;
        const processedContent = this.escapeSpecialCharacters(content);
        const requestContent = [{ "Text": processedContent }];

        try {
            const texts = await this.requestAzure<{ translations: { text: string }[] }[]>(
                "POST",
                path,
                requestContent
            );
            const text = (texts || []).pop();
            const translation = text?.translations.pop();
            return translation?.text;
        } catch (err) {
            this.logger.error(err, "translation");
            if (err.timeout) {
                throw new CogtnitiveAPITimeout();
            }
            const responseText = err.response && err.response.text;
            const responseTextObj = responseText && JSON.parse(err.response.text);
            const errorCode = responseTextObj && responseTextObj.error && responseTextObj.error.code;
            const errorIsInSource = errorCode === FROM_UNSUPPORTED_LANG_ERROR_CODE;
            const unsupportedLanguageCode = errorIsInSource ? sourceLanguageCode : targetLanguageCode;
            const error = UNSUPPORTED_LANG_ERROR_CODES.find(c => c === errorCode) ?
                new UnsupportedLanguageError(unsupportedLanguageCode) :
                err;
            throw error;
        }
    }

    protected async fetchSupportedLanguages(): Promise<IEngineLanguage[]> {
        try {
            type ResponseType = {
                translation: {
                    [code: string]: {
                        name: string,
                        nativeName: string,
                        dir: "ltr" | "rtl"
                    }
                }
            };
            const response = await this.requestAzure<ResponseType>("GET", "/languages?api-version=3.0");
            const translation = response.translation;
            return Object.keys(translation).map(k => ({
                ...translation[k],
                code: standardizeLanguageCode(k),
            }));
        } catch (err) {
            this.logger.logException(err, "translation languages");
            return [];
        }
    }

    async detectLanguage(content: string): Promise<string> {
        try {
            const languages = await this.requestAzure<{ language: string }[]>(
                "POST",
                "/detect?api-version=3.0",
                [{ "Text": content }]
            );
            const detectLanguage = (languages || []).pop();
            return detectLanguage?.language;
        } catch (err) {
            this.logger.error(err, "detect languages");
            if (err.timeout) {
                throw new CogtnitiveAPITimeout();
            }
            const responseText = err.response && err.response.text;
            const responseTextObj = responseText && JSON.parse(err.response.text);
            const errorCode = responseTextObj && responseTextObj.error && responseTextObj.error.code;
            throw new Error(`Error ${errorCode}: ${responseText}`);
        }
    }

    private requestAzure<T>(
        method: "POST" | "GET",
        path: string,
        body?: string | unknown[] | Record<string, unknown>
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const url = `https://${this.host}${path}`;
            let requestObj = method === "POST" ? request.post(url) : request.get(url);
            if (body != null) {
                requestObj = requestObj.send(body);
            }

            requestObj
                .set("Content-Type", "application/json")
                .set("Ocp-Apim-Subscription-Key", this.subscriptionKey)
                .set("X-ClientTraceId", this.generateGUID())
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
        return text
            .replace(/([\u2200-\u22ff])/g, "<span class=\"notranslate\">$1</span>") // Math symbols
            .replace(/(\u2139\ufe0f?)/g, "<span class=\"notranslate\">$1</span>"); // ℹ️ emoji, Azure has an issue with this and turns it into an "i"
    }

    private generateGUID() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static fromConfig(config: Config): AzureEngine {
        const translatorConfig = config.getObject("translator.azure") as Maybe<{ host: string, subscriptionKey: string }>;
        const { host, subscriptionKey } = translatorConfig.get();
        return new AzureEngine(host, subscriptionKey, config);
    }
}
