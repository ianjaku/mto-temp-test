import { ItemKind, resolveKindFromIndex } from "../../../src/elastic";

function testCase(indexName: string, expectedResult: ItemKind) {
    const kind = resolveKindFromIndex(indexName);
    expect(kind).toEqual(expectedResult);
}

describe("resolveKindFromIndex", () => {
    it("should return 'document' for 'binders-binders-v3'", () => {
        testCase("binders-binders-v3", "document");
    });

    it("should return 'document' for 'binders-binders-v4'", () => {
        testCase("binders-binders-v4", "document");
    });

    it("should return 'collection' for 'binders-collections-v3'", () => {
        testCase("binders-collections-v3", "collection");
    });

    it("should return 'collection' for 'binders-collections-v4'", () => {
        testCase("binders-collections-v4", "collection");
    });

    it("should return 'publication' for 'publications-v2'", () => {
        testCase("publications-v2", "publication");
    });

    it("should return 'publication' for 'publications-v3'", () => {
        testCase("publications-v3", "publication");
    });

    it("should throw an error for an unknown index", () => {
        expect(() => resolveKindFromIndex("unknown-v3")).toThrow(Error);
    });
});
