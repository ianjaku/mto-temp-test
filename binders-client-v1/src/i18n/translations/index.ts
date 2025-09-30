import MasterLanguage from "./en_US";

export type Translation = typeof MasterLanguage;

const buildTranslationKeys = (): Translation => {
    const result = {};
    for (const k of Object.keys(MasterLanguage)) {
        result[k] = k;
    }
    return result as Translation;
}
export const TranslationKeys = buildTranslationKeys();
