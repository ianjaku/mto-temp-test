import {
    mergeRawJsonDocuments,
} from "@binders/client/lib/util/tiptap";

describe("mergeRawJsonDocuments", () => {
    it("should merge two valid raw docs", () => {
        const doc1 = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello, world!", }] }],
        };
        const doc2 = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Goodbye, world!" }] }],
        };
        const result = mergeRawJsonDocuments([JSON.stringify(doc1), JSON.stringify(doc2)]);
        expect(result).toEqual(JSON.stringify({
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "Hello, world!" }] },
                { type: "paragraph", content: [{ type: "text", text: "Goodbye, world!" }] },
            ],
        }));
    });

    it("should disregards invalid docs", () => {
        const rawDoc1 = "{\"typ\": \"whatever\", \"content\": []}";
        const doc2 = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello, world!" }] }],
        };
        const doc3 = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Goodbye, world!" }] }],
        };
        const result = mergeRawJsonDocuments([rawDoc1, JSON.stringify(doc2), JSON.stringify(doc3)]);
        expect(result).toEqual(JSON.stringify({
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "Hello, world!" }] },
                { type: "paragraph", content: [{ type: "text", text: "Goodbye, world!" }] },
            ],
        }));
    });

    it("should return an empty string if no valid docs are provided", () => {
        const rawDoc1 = "{\"typ\": \"what\", \"content\": []}";
        const rawDoc2 = "{\"typ\": \"ever\", \"content\": []}";
        const result = mergeRawJsonDocuments([rawDoc1, rawDoc2]);
        expect(result).toEqual("");
    });



});