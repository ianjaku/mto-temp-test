import { Answers, DistinctQuestion } from "inquirer";
import inquirer from "inquirer";
import { insertI18nString } from "./insert";
import { machineTranslate } from "./translate";

const langNames: Record<string, string> = {
    en: "English",
    nl: "Dutch",
    fr: "French",
    de: "German",
}

export interface Translation { langCode: string, text: string, isConfident: boolean }

const questions: DistinctQuestion[] = [
    {
        type: "input",
        name: "identifier",
        message: "Enter then identifier of the string, eg. General_NewLabel:",
        validate(value: string) {
            const valid = !!value;
            return valid || "Please enter an identifier";
        },
    },
    {
        type: "input",
        name: "langcodesCsv",
        message: "Enter the target languages csv:",
        default: "en,nl,fr,de",
        validate(value: string) {
            const valid = !!value;
            return valid || "Please enter the target languages";
        },
    }
];

function buildLangCodeQuestions(langCode: string, suggestion?: string): DistinctQuestion[] {
    const langName = `${langNames[langCode] || langCode}`;
    return [
        {
            type: "input",
            name: "text",
            message: `Enter the ${langName} translation:`,
            ...(suggestion ? { default: suggestion } : {}),
            validate(value: string) {
                const valid = !!value;
                return valid || `Please enter the ${langName} translation`;
            },
        },
        {
            type: "confirm",
            name: "isConfident",
            message: "Are you confident about this translation?",
            default: false,
            transformer: (answer: string) => (answer ? "👍" : "👎"),
        } as unknown as DistinctQuestion,
    ]
}

export async function i18nPrompt(): Promise<void> {
    const { identifier, langcodesCsv } = await inquirer.prompt(questions);

    const translations: Record<string, Translation> = {};
    let masterTranslation: Translation | undefined = undefined;
    let autoTranslationDisabled = true;
    let i = 0;

    for (const langCode of langcodesCsv.split(",")) {

        let suggestedText: string | undefined = undefined;
        if (masterTranslation && !autoTranslationDisabled) {
            try {
                suggestedText = await machineTranslate(masterTranslation.langCode, langCode, masterTranslation.text);
            } catch (error) {
                if (!autoTranslationDisabled) {
                    console.log("\n⚠️  Auto-translation is disabled due to Deepl service failure");
                    autoTranslationDisabled = true;
                }
            }
        }

        const answers: Answers = await inquirer.prompt(buildLangCodeQuestions(langCode, suggestedText));
        const translation = { ...answers, langCode } as Translation;
        if (i === 0) {
            masterTranslation = translation;
        }
        translations[langCode] = translation;
        i++;
    }

    await insertI18nString(identifier, translations);

}