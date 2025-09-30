import {
    getOptions,
    loadTranslations,
    pullTranslations,
    shouldContinue,
    validateBranch,
    validatePullChanges
} from  "./googlesheet/util";
import { dumpFile } from "../../lib/fs";
import { getJWTClient } from "../../lib/googleapis/sheets";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { sheets as sheetsApi } from "@googleapis/sheets";
import { validateLanguageVariables } from "@binders/client/lib/i18n/util";

function buildLanguageFileLine(key, translations) {
    const translation = translations[key];
    if (!translation) {
        throw new Error(`Missing translation for ${key}`);
    }
    const quote = "`";
    return `    ${key}: ${quote}${translation}${quote},`;
}

async function dumpTranslation(language, translations) {
    const keys = Object.keys(translations);
    keys.sort();
    const repoRoot = await getLocalRepositoryRoot();
    const translationsFile = `${repoRoot}/binders-client-v1/src/i18n/translations/${language}.ts`;
    const disableEslintQuotes = "/* eslint-disable quotes */\n";
    const prefix = language === "en_US" ?
        "const translation = {\n" :
        "import { Translation } from \"./index\";\n\nconst translation: Translation = {\n";
    const infix = keys
        .map( (key) => buildLanguageFileLine(key, translations))
        .join("\n");
    const suffix = "\n};\n\nexport default translation;\n";
    await dumpFile(translationsFile, disableEslintQuotes + prefix + infix + suffix);
}

main( async () => {
    const { privateKey } = getOptions();
    await validateBranch();
    const client = await getJWTClient(privateKey);
    const sheets = sheetsApi({ version: "v4", auth: client });
    const translations = await loadTranslations();
    const languages = Object.keys(translations);
    const tKeys = Object.keys(translations.en_US);
    const pulledTranslations = await pullTranslations(sheets, languages, tKeys);
    const { changedLanguages, errors } = await validatePullChanges(translations, pulledTranslations);
    if (changedLanguages.length + errors.length > 0) {
        await shouldContinue();
    } else {
        log("No changes detected");
        return;
    }
    const languagesWithVariableErrors = {};
    for (const changedLanguage of changedLanguages) {
        log("Validating variables in language file " + changedLanguage);
        const variableErrorKeys = validateLanguageVariables(changedLanguage, pulledTranslations);
        if (variableErrorKeys.length > 0) {
            languagesWithVariableErrors[changedLanguage] = variableErrorKeys;
        }
    }
    if (Object.keys(languagesWithVariableErrors).length > 0) {
        log(JSON.stringify(languagesWithVariableErrors, null, 2));
        throw new Error("Variable errors detected");
    }
    for (const changedLanguage of changedLanguages) {
        log("Updating language file " + changedLanguage);
        await dumpTranslation(changedLanguage, pulledTranslations[changedLanguage]);
    }
});