import { safeJsonParse } from "./json";

type JsonDoc = {
    type: string;
    content: unknown[],
};

const ValidJSONContent = doc => doc?.type === "doc" && Array.isArray(doc?.content);

export function mergeRawJsonDocuments(jsonDocuments: string[]): string {
    const documents = jsonDocuments.map(json => safeJsonParse<JsonDoc>(json));
    const validDocuments = documents.filter(ValidJSONContent);
    if (!validDocuments.length) {
        return "";
    }
    const mergedDocument = {
        type: "doc",
        content: validDocuments.flatMap(doc => doc.content),
    }
    return JSON.stringify(mergedDocument);
}

export const EMPTY_JSON_DOCUMENT = JSON.stringify({
    type: "doc",
    content: [],
});