export type CsvError = {
    type: "error";
    error: string;
}

export type CsvParseResult<T> = CsvError | {
    type: "table";
    rows: CsvParsedRow<T>[];
    columnCount: number;
    hasError: boolean;
}

export type CsvRowError = {
    type: "error";
    error: string;
}

export type CsvParsedRow<T> = CsvRowError | {
    type: "row";
    cell: T;
    errors: Partial<T>;
}

export function isError<T>(row: CsvParsedRow<T>): row is CsvRowError {
    return row.type === "error";
}
