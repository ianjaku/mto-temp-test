import * as validator from "validator";
import { CsvParseResult, CsvParsedRow } from "./types";
import { User, UserImportResult } from "@binders/client/lib/clients/userservice/v1/contract";
import { TFunction } from "@binders/client/lib/i18n";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { isEmpty } from "ramda";
import { validateLanguageCode } from "@binders/client/lib/clients/validation";

function stringOrEmpty(value: string | null): string {
    if (!value || value.trim().length === 0) {
        return "";
    }
    return value;
}

export function parseUsersArrays(userArrays: string[][], t: TFunction): CsvParseResult<User> {
    const rows: CsvParsedRow<User>[] = [];
    let hasError = false;
    let columnCount = 0;

    for (const userArray of userArrays.splice(1)) {
        const firstName = stringOrEmpty(userArray[0]);
        const lastName = stringOrEmpty(userArray[1]);
        const login = stringOrEmpty(userArray[2]);
        const preferredLanguage = stringOrEmpty(userArray[3]);
        const groups = userArray.length > 4 && !isEmpty(userArray[4]) ? userArray[4].trim() : undefined;
        if (userArray.length > columnCount) {
            columnCount = userArray.length;
        }

        const errors: Partial<User> = {};

        // check if at least 3 values
        if (userArray.length < 3 && userArray.length > 0) {
            rows.push({
                type: "error",
                error: t(TK.User_CSVNotEnoughValuesInRow),
            });
            hasError = true;
            continue
        }

        if (isEmpty(login)) {
            errors.login = t(TK.General_ValueMandatory);
            hasError = true;
        } else if (!validator.isEmail(login)) {
            errors.login = t(TK.General_WrongEmail);
            hasError = true;
        }

        // check if language really a language
        if (!isEmpty(preferredLanguage)) {
            const languageErrors = validateLanguageCode(preferredLanguage);
            if (languageErrors.length > 0) {
                errors.preferredLanguage = languageErrors.join(", ");
                hasError = true;
            }
        }

        const isGroupsValueFilledIn = groups && groups.replace(/[[\]]/g, "");
        const selectedGroups = isGroupsValueFilledIn ? isGroupsValueFilledIn.split(";").map((el) => el.trim()).filter(el => !!el) : [];

        const displayName = `${firstName} ${lastName}`.trim() ||  login;

        if (!rows.find(r => r.type === "row" && r.cell.login === login)) {
            const newElement: User = {
                id: "",
                created: new Date(),
                updated: null,
                licenseCount: 0,
                type: null,
                displayName,
                login,
                firstName,
                lastName,
                preferredLanguage,
                groups: selectedGroups,
            }
            const row: CsvParsedRow<User> = {
                type: "row",
                cell: newElement,
                errors,
            };
            rows.push(row);
        }
    }
    return { type: "table", columnCount, hasError, rows };
}

export function manualtoUsersToTable(importResults: UserImportResult[]): string[][] {
    return [
        ["display name", "first name", "last name", "email", "invitation link"],
        ...importResults.map((result) => [
            result.user.displayName,
            result.user.firstName,
            result.user.lastName,
            result.user.login,
            result.invitationLink
        ]),
    ];
}

export function buildCsvContent(table: string[][]): string {
    return table.map(row => row.join(",")).join("\n");
}
