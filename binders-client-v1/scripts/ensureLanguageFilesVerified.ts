import { TranslationMap, validateLanguageVariables } from "../src/i18n/util";
import DutchTranslations from "../src/i18n/translations/nl";
import EnglishTranslations from "../src/i18n/translations/en_US";
import FrenchTranslations from "../src/i18n/translations/fr";

const MACHINE_TRANSLATION_CHARACTERS = ["__", "Ω"];

const ACTIVE_TRANSLATIONS = {
    en_US: EnglishTranslations,
    nl: DutchTranslations,
    fr: FrenchTranslations,
};

const run = () => {
    const machineTranslatedKeys: {key: string; lang: string}[] = [];
    for (const languageCode of Object.keys(ACTIVE_TRANSLATIONS)) {
        const translations = ACTIVE_TRANSLATIONS[languageCode];
        for (const key of Object.keys(translations)) {
            const value = translations[key];
            for (const machineTranslationCharacter of MACHINE_TRANSLATION_CHARACTERS) {
                if (value.includes(machineTranslationCharacter)) {
                    machineTranslatedKeys.push({key, lang: languageCode});
                }
            }
        }
    }

    if (machineTranslatedKeys.length > 0) {
        throw new Error(`
Not all machine translated keys have been verified.
Please check the following keys,
and if they are correct remove the (${MACHINE_TRANSLATION_CHARACTERS.join(", ")}) characters:
${JSON.stringify(machineTranslatedKeys, null, 2)}`
        );
    }
    const languagesWithVariableErrors = {};
    for (const languageCode of Object.keys(ACTIVE_TRANSLATIONS)) {
        const translationErrors = validateLanguageVariables(languageCode, ACTIVE_TRANSLATIONS as TranslationMap);
        if (translationErrors.length > 0) {
            languagesWithVariableErrors[languageCode] = translationErrors;
        }
    }
    if (Object.keys(languagesWithVariableErrors).length > 0) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(languagesWithVariableErrors, null, 2));
        throw new Error("Variable errors detected");
    }
}

run();
