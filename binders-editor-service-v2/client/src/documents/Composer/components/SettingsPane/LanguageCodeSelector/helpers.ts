import { countWords, truncate } from "../../../../helper";
import { APIDetectLanguage } from "../../../../api";
import Binder from "@binders/client/lib/binders/custom/class";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";

export async function detectLanguage(binder: Binder): Promise<string> {
    const MINIMUM_WORD_NUMBER = 5
    const documentWithUndefinedText = binder.getRawTextForLanguage(UNDEFINED_LANG)
    const wordsInDocument = countWords(documentWithUndefinedText);
    if (wordsInDocument >= MINIMUM_WORD_NUMBER) {
        const truncatedText = truncate(documentWithUndefinedText, 50)
        const detectedLanguageCode = await APIDetectLanguage(truncatedText)
        if (detectedLanguageCode) {
            return detectedLanguageCode;
        }
    }

}