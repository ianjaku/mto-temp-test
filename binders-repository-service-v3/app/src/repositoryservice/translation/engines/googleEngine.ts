import * as request from "superagent";
import { ITranslationParams, MTEngine } from "./engine";
import { Config } from "@binders/client/lib/config/config";
import { IEngineLanguage } from "./types";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Maybe } from "@binders/client/lib/monad";

export const TRANSLATE_TIMEOUT = "Timeout in post to google translator API"
const GOOGLE_API_CHAR_LIMIT = 5000;

type TranslateResponseType = { data: { translations: [{ translatedText: string }] } };
type DetectResponseType = { data: { detections: Array<Array<{ confidence: number, isReliable: boolean, language: string }>> } }

export class GoogleEngine extends MTEngine {

    public type = MTEngineType.Google;

    constructor(
        private host: string,
        private subscriptionKey: string,
        config: Config
    ) {
        super(MTEngineType.Google, config);
    }

    getCharLimit(): number {
        return GOOGLE_API_CHAR_LIMIT;
    }

    async translate({ content, sourceLanguageCode, targetLanguageCode, isHTML }: ITranslationParams): Promise<string> {
        this.logger.debug(`[Google] Translating ${content} from ${sourceLanguageCode} to ${targetLanguageCode}`, "translating");
        const processedContent = this.escapeSpecialCharacters(content);

        const source = !sourceLanguageCode || sourceLanguageCode.toLowerCase() === "xx" ?
            undefined :
            sourceLanguageCode;
        const target = targetLanguageCode;

        try {
            const result = await this.requestGoogle<TranslateResponseType>(
                "POST",
                "/",
                {
                    q: processedContent,
                    ...(source ? {} : { source }),
                    target,
                    format: isHTML ? "html" : "text",
                }
            );
            const translation = ((result.data?.translations) || []).pop();
            const translatedText = translation?.translatedText;
            return translatedText;
        } catch (err) {
            this.logger.error(err, "translation");
            throw err;
        }
    }

    protected async fetchSupportedLanguages(): Promise<IEngineLanguage[]> {
        try {
            type ResponseType = {
                data: {
                    languages: {
                        language: string,
                        name: string
                    }[]
                }
            };
            const response = await this.requestGoogle<ResponseType>(
                "POST",
                "/languages",
                {
                    target: "en"
                }
            );
            return response.data?.languages.map<IEngineLanguage>(lang => ({
                code: lang.language,
                name: lang.name,
                nativeName: lang.name,
                dir: "ltr" // We don't receive reading direction information from Google.
            }));
        } catch (err) {
            this.logger.logException(err, "translation languages");
            return [];
        }
    }

    async detectLanguage(content: string): Promise<string> {
        try {
            const result = await this.requestGoogle<DetectResponseType>("POST", "/detect", { q: content });
            const detections = result.data.detections.reduce((acc, detectionArr) => [...acc, ...detectionArr], []);
            const detection = detections.pop();
            const detectedLanguage = detection?.language;
            return detectedLanguage;
        } catch (err) {
            this.logger.error(err, "detect languages");
            const responseText = err.response && err.response.text;
            const responseTextObj = responseText && JSON.parse(err.response.text);
            const errorCode = responseTextObj && responseTextObj.error && responseTextObj.error.code;
            throw new Error(`Error ${errorCode}: ${responseText}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    private requestGoogle<T>(method: "POST" | "GET", path: string, body?: Record<string, unknown>): Promise<T> {
        return new Promise((resolve, reject) => {
            const url = `https://${this.host}${path}?key=${this.subscriptionKey}`;
            let requestObj = method === "POST" ? request.post(url) : request.get(url);
            if (body != null) {
                requestObj = requestObj.send(body);
            }
            requestObj
                .set("Content-Type", "application/json")
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
        return text.replace(/([\u2200-\u22ff])/g, "<span class=\"notranslate\">$1</span>");
    }

    static fromConfig(config: Config): GoogleEngine {
        const translatorConfig = config.getObject("translator.google") as Maybe<{host: string, subscriptionKey: string}>;
        const { host, subscriptionKey } = translatorConfig.get();
        return new GoogleEngine(host, subscriptionKey, config);
    }
}
