import { CsvParseResult, CsvParsedRow } from "../../../hooks/types";
import { CevaUser } from "@binders/client/lib/clients/userservice/v1/contract";
import { TFunction } from "@binders/client/lib/i18n";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { range } from "ramda";

const CSV_HEADER_ROWS = 5;
const CSV_FOOTER_ROWS = 2;
const CSV_TABLE_HEADER_ROW = [
    "MW nummer",
    undefined,
    "Datum",
    undefined,
    undefined,
    "Starttijd",
    undefined,
    "Eindtijd",
    "Organisatie",
    undefined,
    undefined,
    "Achternaam",
    undefined,
    "Voornaam",
    undefined,
    "Dienst",
    "Adm Comp",
    undefined,
    "Netto uren"
];

function asString(cell: string): string {
    return cell.toString().trim();
}

function isBlank(cell: string): boolean {
    return cell == null || cell.length === 0;
}

function hasSameValues<T>(left: (T | null | undefined)[], right: (T | null | undefined)[]): boolean {
    if (left.length != right.length) return false;
    return range(0, left.length)
        .filter(idx => left[idx] == null && right[idx] == null || left[idx] === right[idx])
        .length === left.length;
}

function isDepartmentTitleRow(row: string[]): boolean {
    const expectedNotEmptyIdxs = [0, 17, 19];
    const nonEmptyIdxs = range(0, row.length).filter(idx => !isBlank(row[idx]));
    return hasSameValues(expectedNotEmptyIdxs, nonEmptyIdxs);
}

function isDepartmentRow(rows: string[][], startIdx: number): boolean {
    return startIdx + 2 <= rows.length &&
        isDepartmentTitleRow(rows[startIdx]) &&
        hasSameValues(rows[startIdx + 1], CSV_TABLE_HEADER_ROW);
}

function emptyOrNone(val: string, fallback: string): string | undefined {
    return isBlank(val) ? fallback : undefined;
}

function rowToObject(row: string[], department: string): CevaUser {
    return {
        employeeId: row[0],
        organization: row[8],
        service: row[15],
        department,
        firstName: row[11],
        lastName: row[13],
    }
}

export function parseCevaRows(rawTable: (string | number)[][], t: TFunction): CsvParseResult<CevaUser> {
    const table = rawTable.map(row => row.map(asString));
    const lastIdx = table.length - CSV_FOOTER_ROWS - 1;
    const columnCount = table.length && table[0].length || 0;
    let hasError = false;
    let rowIdx = CSV_HEADER_ROWS;
    const rows: CsvParsedRow<CevaUser>[] = [];

    if (table.length <= CSV_HEADER_ROWS + CSV_FOOTER_ROWS) {
        return {
            type: "error",
            error: t(TK.Ceva_ImportErrorTableEmpty),
        };
    }

    // Skip empty lines at the beginning
    while (table[rowIdx].join("").trim().length === 0 && rowIdx <= lastIdx) {
        rowIdx += 1;
    }

    if (!isDepartmentRow(table, rowIdx)) {
        return {
            type: "error",
            error: t(TK.Ceva_ImportErrorTableInvalidRow, { rowIdx: rowIdx + 1 }),
        };
    }

    const missingValueStr = t(TK.General_ValueMandatory);
    while (isDepartmentRow(table, rowIdx) && rowIdx <= lastIdx) {
        // each department has a title row with its name in the first column
        const department = table[rowIdx][0];
        // followed by table header row
        rowIdx += 2;
        while (!isDepartmentRow(table, rowIdx) && rowIdx <= lastIdx) {
            const currentRow = table[rowIdx];
            if (!currentRow.length || !rowHasEmployeeId(currentRow)) {
                rowIdx += 1;
                continue;
            }

            const user = rowToObject(currentRow, department);
            const errors: Partial<CevaUser> = {};

            errors.organization = emptyOrNone(user.organization, missingValueStr)
            errors.service = emptyOrNone(user.service, missingValueStr)
            errors.lastName = emptyOrNone(user.lastName, missingValueStr)
            errors.firstName = emptyOrNone(user.firstName, missingValueStr)

            const foundNewErrors = Object.values(errors)
                .filter(v => !isBlank(v))
                .length > 0;
            hasError = hasError || foundNewErrors;

            rows.push({
                type: "row",
                cell: user,
                errors,
            });
            rowIdx += 1;
        }
    }

    return { type: "table", hasError, columnCount, rows }
}

function rowHasEmployeeId(userRow: string[]): boolean {
    // MT-4152 Sheets can have additional footers at the bottom
    return userRow[0] != null;
}
