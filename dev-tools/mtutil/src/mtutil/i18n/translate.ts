import fetch, { Response } from "node-fetch";
import { getDeeplConfig } from "../../config";

type TranslateResponseType = { translations: [{ detected_source_language: string, text: string }] };

async function requestDeepl<T>(method: "POST" | "GET", path: string, body: Record<string, unknown> = {}): Promise<T> {

    const { host, subscriptionKey } = await getDeeplConfig();
    const formEncodedBody = Object.entries(body).map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`).join("&");
    try {
        const response: Response = await fetch(`https://${host}${path}`, {
            method,
            body: formEncodedBody,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `DeepL-Auth-Key ${subscriptionKey}`
            }
        });

        if (!response.ok) {
            throw new Error("Auto-translation failed");
        }

        const text = await response.text();
        if (text == null) {
            return null;
        }
        return JSON.parse(text);
    } catch (error) {
        console.error("error", error);
        throw new Error("Auto-translation failed");
    }
}

export async function machineTranslate(
    fromLangCode: string,
    toLangCode: string,
    text: string,
): Promise<string> {
    const result = await requestDeepl<TranslateResponseType>(
        "POST",
        "/translate",
        {
            text,
            source_lang: fromLangCode,
            target_lang: toLangCode,
        }
    );
    const translation = ((result.translations) || []).pop();
    return translation?.text;

}
