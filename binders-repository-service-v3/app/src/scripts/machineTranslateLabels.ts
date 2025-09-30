/* eslint-disable no-console */
import * as fs from "fs";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Translation } from "@binders/client/lib/i18n/translations";
import Translator from "../../src/repositoryservice/translation/translator";
import baseTranslation from "@binders/client/lib/i18n/translations/en_US";
import dutchTranslation from "@binders/client/lib/i18n/translations/nl";
import frenchTranslation from "@binders/client/lib/i18n/translations/fr";

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <TARGET_LANGUAGE_TO_TRANSLATE>`);
        process.exit(1);
    }
    return {
        targetLanguage: process.argv[2],
    };
};

const { targetLanguage } = getOptions();

const getTargetTranslation = (): Partial<Translation> => {
    switch (targetLanguage) {
        case "fr":
            return frenchTranslation;
        case "nl":
            return dutchTranslation;
        default:
            return {} as Translation;
    }
};


const doIt = async () => {
    const config = BindersConfig.get();
    const translator = await Translator.fromConfig(config);
    const translationKeys = Object.keys(baseTranslation);
    const targetTranslation = getTargetTranslation();
    let translationContent = "import { Translation } from \"./index\";\n\nconst translation: Translation = {\n";
    for (const tk of translationKeys) {
        const text = baseTranslation[tk];
        let translation = targetTranslation[tk];
        const hasTranslation = !!translation;
        if (!hasTranslation) {
            const textToTranslate = text.replace(/(\{\{(-\s?)?(\w+)\}\})/g, "<span class=\"notranslate\">$1</span>");
            translation = await translator.translate(textToTranslate, "en", targetLanguage, true);
        }
        let textTranslation = translation
            .replace(/<\/?span(\sclass="notranslate")?>/g, "")
            .replace(/"/g, "\\\"");
        if (!hasTranslation) {
            textTranslation = textTranslation.replace("Ω", "")
        }
        const quote = textTranslation.includes("\n") ? "`" : "\"";
        translationContent = `${translationContent}    ${tk}: ${quote}${textTranslation}${hasTranslation ? "" : "Ω"}${quote},\n`;
    }
    translationContent = `${translationContent}};\n\nexport default translation;\n`;
    fs.writeFileSync(`/tmp/${targetLanguage}.ts`, translationContent);
    console.log(translationContent);
};

const start = Date.now();
doIt()
    .then(() => {
        console.log(`All done in ${(Date.now() - start) / 60000} minutes`);
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });