import { CellValue, isPlainCell } from "../../../lib/googleapis/sheets";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../../lib/optionParser";
import { TranslationMap } from "@binders/client/lib/i18n/util";
import de from "@binders/client/lib/i18n/translations/de";
import { difference } from "ramda";
import en_US from "@binders/client/lib/i18n/translations/en_US";
import fr from "@binders/client/lib/i18n/translations/fr";
import { getChar } from "../../../lib/diff";
import { getCurrentBranch } from "../../../actions/git/branches";
import log from "../../../lib/logging";
import nl from "@binders/client/lib/i18n/translations/nl";
import { sheets_v4 } from "@googleapis/sheets";

export const SPREADSHEET_ID = "1bJo1OkG2rZQtgb-3wmVPXxhY_kM4a5_BrtTOy6SwQjU";

export const getOptions = (): { privateKey: string } => {
    const programDefinition: IProgramDefinition = {
        privateKey: {
            long: "privateKey",
            short: "p",
            description: "The Google private Key to use (1Password)",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("syncGoogleSheet", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { privateKey } = (<any>parser.parse());
    return { privateKey };
}

export const isMT = (value: CellValue): boolean => {
    const toCheck = isPlainCell(value) ? value : value.value;
    return toCheck.includes("__") || toCheck.includes("Ω")
};


export const loadTranslations = (): TranslationMap => ({
    en_US,
    nl,
    fr,
    de
})

const ALLOWED_BRANCHES = [
    "rel-r7-june25",
]

export async function validateBranch(): Promise<void> {
    const currentBranch = await getCurrentBranch();
    if (!ALLOWED_BRANCHES.includes(currentBranch)) {
        throw new Error(`Cannot run the sync script from this branch. Allowed branches are: ${ALLOWED_BRANCHES.join(", ")}`);
    }
}
export async function pullTranslations(sheets: sheets_v4.Sheets, languages: string[], keys: string[]): Promise<TranslationMap> {
    const keyCount = keys.length;
    const currentValues = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!A1:Z${keyCount + 2}`
    });
    const cellValues = currentValues.data.values || [];
    const pulledTranslations = {};
    languages.forEach( (language) => pulledTranslations[language] = {} );
    for (let i = 1; i < cellValues.length; i++) {
        languages.map( (language, index) => {
            pulledTranslations[language][cellValues[i][0]] = cellValues[i][index + 1];
        });
    }
    return pulledTranslations as TranslationMap;
}

export async function shouldContinue(): Promise<void> {
    const char = await getChar("Do you want to continue? (y/*)");
    if (char !== "y") {
        throw new Error("Aborting");
    }
}

export interface ValidationResult {
    errors: string[];
    changedLanguages: string[];
}


export async function validatePushChanges(localTranslations: TranslationMap, pulledTranslations: TranslationMap): Promise<ValidationResult> {
    return validateChanges(localTranslations, pulledTranslations, false);
}

export async function validatePullChanges(localTranslations: TranslationMap, pulledTranslations: TranslationMap): Promise<ValidationResult> {
    return validateChanges(localTranslations, pulledTranslations, true);
}

async function validateChanges(localTranslations: TranslationMap, remoteTranslations: TranslationMap, isPull: boolean): Promise<ValidationResult> {
    const errors = [];
    const changedLanguages = new Set<string>();
    const localLanguages = Object.keys(localTranslations);
    for (const localLanguage of localLanguages) {
        const local = localTranslations[localLanguage];
        const localKeys = Object.keys(local);
        const remote = remoteTranslations[localLanguage];
        const remoteKeys = Object.keys(remote) || [];
        const missingKeys = isPull?
            difference(remoteKeys, localKeys) :
            difference(localKeys, remoteKeys);
        const extraKeys = isPull ?
            difference(localKeys, remoteKeys) :
            difference(remoteKeys, localKeys);
        const infix = isPull ? "remote" : "local";
        if (missingKeys.length > 0) {
            errors.push(`Missing keys in ${infix} [${localLanguage}]: ${missingKeys.join(", ")}`);
        }
        if (extraKeys.length > 0) {
            errors.push(`Extra keys in ${infix} [${localLanguage}]: ${extraKeys.join(", ")}`);
        }
        for (const localKey of localKeys) {
            const localValue = local[localKey];
            const remoteValue = remote[localKey];
            if (remoteValue === localValue) {
                continue;
            }
            changedLanguages.add(localLanguage);
            const check = isPull ?
                localValue && remoteValue && isMT(remoteValue) && !isMT(localValue) :
                localValue && remoteValue && !isMT(remoteValue) && isMT(localValue);

            if (check) {
                errors.push(`Continuing will overwrite a verified translation: [${localKey}] in [${localLanguage}]`);
            }
            if (isPull) {
                log(`Will update local value for [${localKey}] in [${localLanguage}] from [${localValue}] to [${remoteValue}]`)
            } else {
                log(`Will update remote value for [${localKey}] in [${localLanguage}] from [${remoteValue}] to [${localValue}]`)
            }
        }
    }
    return {
        changedLanguages: Array.from(changedLanguages),
        errors
    };
}

export function autoDimension(rowCount: number): { deleteDimension: sheets_v4.Schema$DeleteDimensionRequest } {
    return {
        deleteDimension: {
            range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: rowCount
            }
        }
    }
}