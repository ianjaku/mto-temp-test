import { Translation } from "./translations"
import { difference } from "ramda";

export interface TranslationMap {
    en_US: Translation,
    nl: Translation,
    fr: Translation,
    de: Translation
}

function extractVariables(value: string): string[] {
    const regex = /{{(.*?)}}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(value)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}


export function validateLanguageVariables(languageCode: string, translations: TranslationMap): string[] {
    const baseLanguageCode = languageCode === "en_US" ? "nl" : "en_US";
    const baseTranslations = translations[baseLanguageCode];
    const toValidate = translations[languageCode];
    const baseKeys = Object.keys(baseTranslations);
    const keysWithVariableErrors = [];
    for (const baseKey of baseKeys) {
        const baseVariables = extractVariables(baseTranslations[baseKey]);
        const toValidateVariables = extractVariables(toValidate[baseKey]);
        const missingVarables = difference(baseVariables, toValidateVariables);
        const extraVariables = difference(toValidateVariables, baseVariables);
        if (missingVarables.length + extraVariables.length > 0 ) {
            keysWithVariableErrors.push(baseKey);
        }
    }
    return keysWithVariableErrors;
}
