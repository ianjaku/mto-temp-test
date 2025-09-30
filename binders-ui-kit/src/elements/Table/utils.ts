import { dateSorterAsc, dateSorterDesc, fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { SORT } from "./types";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function prepareDatesFormats(normalizedHeaders, data) {
    // check all indexes of dates columns
    const indexes = normalizedHeaders.reduce((result, { type }, key) => {
        return type === "date" ? [...result, key] : result;
    }, []);

    if (indexes.length > 0) {
        return data.map((row) => {
            const tempRow = [...row];
            // change each field with apropriate format
            indexes.forEach((index: number) => {
                tempRow[index] = row[index] && fmtDateIso8601TZ(row[index]);
            });
            return tempRow;
        });
    }
    return data;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function filterExportOnlyColumns(data) {
    return data.map(row => {
        return Array.isArray(row) ? row.filter(col => !col || !col.exportOnly) : row;
    });
}

// try to recognize fields without type declaration
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function prepareHeaders(headers, exampleRow) {
    return headers.map((item, idx: number) => {
        // if dev provided label and type
        if (item.label && item.type) {
            return item;
        }
        // no example row or empty value
        if (!exampleRow || exampleRow[idx] === "" || item === "") {
            return {
                label: item,
                type: "string",
            };
        }
        // try to parse as number
        if (Number.isInteger(exampleRow[idx] ? (exampleRow[idx].value || exampleRow[idx]) : exampleRow[idx])) {
            return {
                label: item,
                type: "number",
            };
        }
        return {
            label: item,
            type: "string",
        };
    });
}

// prepared sort function for 3 data formats
export const sortFunctions = {
    "date": (order: SORT, item1: Date, item2: Date): number => {
        return (order === SORT.ASC) ?
            dateSorterAsc(item1, item2) :
            dateSorterDesc(item1, item2);
    },
    "number": (order: SORT, item1: number, item2: number): number => {
        return (order === SORT.ASC) ?
            item1 - item2 :
            item2 - item1;

    },
    "string": (order: SORT, item1 = "", item2 = ""): number => (order === SORT.ASC) ?
        item1.toString().localeCompare(item2.toString()) :
        item2.toString().localeCompare(item1.toString()),
};


