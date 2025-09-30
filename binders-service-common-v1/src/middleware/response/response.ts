import { formatCsvResponse } from "./formatters/csv";

export enum ResponseFormat {
    JSON = "json",
    CSV = "csv",
}

export interface ResponseFormatOptions {
    format: ResponseFormat;
    csvFormattingOrder?: (string | RegExp)[];
}

export type ResponseFormatter = (value: unknown, options: ResponseFormatOptions) => string;

const formatters: Record<ResponseFormat, ResponseFormatter> = {
    [ResponseFormat.JSON]: value => JSON.stringify(value),
    [ResponseFormat.CSV]: formatCsvResponse
}

export const formatResponse = (value: unknown, options: ResponseFormatOptions): string => {
    const formatter = formatters[options.format];
    if (formatter == null) {
        throw new Error(`Unknown response format ${options.format}`);
    }
    return formatter(value, options);
}

export const getContentTypeHeaderForFormat = (format: ResponseFormat): string => {
    if (format === ResponseFormat.CSV) return "text/csv";
    return "application/json"
}

export const rawFormatToResponseFormat = (accepts: string): ResponseFormat => {
    if (accepts?.includes("text/csv")) return ResponseFormat.CSV;
    if (accepts?.includes("application/json")) return ResponseFormat.JSON;
    if (accepts === "csv") return ResponseFormat.CSV;
    if (accepts === "json") return ResponseFormat.JSON;
    return ResponseFormat.JSON
}