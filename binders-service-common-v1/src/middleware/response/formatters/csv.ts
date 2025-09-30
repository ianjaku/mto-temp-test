import { ResponseFormatOptions } from "../response";


const cleanCsvValue = (value: string): string => {
    const cleanValue = value
        .replace(/'/g, "\\'")
        .replace(/"/g, "'")
        .replace(/\n/g, " ");
    return `"${cleanValue}"`;
}

const formatCsvValue = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "number") return cleanCsvValue(value.toString());
    if (typeof value === "string") return cleanCsvValue(value);
    if (Array.isArray(value)) {
        const json = JSON.stringify(value);
        const jsonWithoutBrackets = json.substring(1, json.length - 1); // Offers a nicer format for arrays in CSVs
        return cleanCsvValue(jsonWithoutBrackets);
    }
    return cleanCsvValue(JSON.stringify(value));
}

const findHeadersInArray = (values: unknown[]): string[] => {
    const headersSet = new Set<string>();
    for (const item of values) {
        if (typeof item !== "object") {
            headersSet.add("Value");
            continue;
        }
        for (const key of Object.keys(item)) {
            headersSet.add(key);
        }
    }
    if (headersSet.size === 0) return ["Value"];
    return Array.from(headersSet).sort();
}

const formatCsvArray = (
    values: unknown[],
    csvFormattingOrder?: (string | RegExp)[]
): string => {
    let headers = findHeadersInArray(values);

    if (csvFormattingOrder) {
        headers = headers.sort((a, b) => {
            const aIndex = csvFormattingOrder.findIndex(
                orderItem => typeof orderItem === "string" ? orderItem === a : orderItem.test(a)
            );
            const bIndex = csvFormattingOrder.findIndex(
                orderItem => typeof orderItem === "string" ? orderItem === b : orderItem.test(b)
            );
            if (aIndex >= 0 && bIndex >= 0 && aIndex !== bIndex) return aIndex - bIndex;

            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return a.localeCompare(b);
        });
    }
    
    const valuesCsv = values.map(value => {
        if (typeof value !== "object") return formatCsvValue(value);
        if (headers.length === 1) return formatCsvValue(value[headers[0]] ?? value);
        return headers.map(header => formatCsvValue(value[header])).join(",");
    }).join("\n");

    return headers.join(",") + "\n" + valuesCsv;
}

export const formatCsvResponse = (value: unknown, options: ResponseFormatOptions): string => {
    if (Array.isArray(value)) {
        if (value.length === 0) return "No results";
        return formatCsvArray(value, options.csvFormattingOrder);
    } else if (typeof value === "object") {
        const headers = [];
        const values = [];
        for (const key in Object.keys(value)) {
            headers.push(key);
            values.push(formatCsvValue(value[key]));
        }
        return `${headers.join(",")}\n${values.join(",")}`;
    } else {
        return `value\n${formatCsvValue(value)}`;
    }
}
