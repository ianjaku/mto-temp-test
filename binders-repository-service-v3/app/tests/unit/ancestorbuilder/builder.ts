import { Map } from "immutable";
import { MemoryAncestorBuilder } from "../../../src/repositoryservice/ancestors/ancestorBuilder";

describe("Ancestor builder", () => {
    it("should get the right ancestor, base case", () => {
        const fakeTree = Map({
            "doc1": [{id: "doc2", isHidden: false, isDeleted: false}]
        });
        const builder = new MemoryAncestorBuilder(fakeTree);
        return builder.getAncestors(["doc1"])
            .then(ancestors => {
                return expect(ancestors.toDocumentAncestors(false)).toEqual({doc1: ["doc2"], doc2: []});
            });
    });
    it("should get the right ancestor, 2 levels case", () => {
        const fakeTree = Map({
            "doc1": [{id: "doc2", isHidden: false, isDeleted: false}],
            "doc2": [{id: "doc3", isHidden: false, isDeleted: false}]
        });
        const builder = new MemoryAncestorBuilder(fakeTree);
        return builder.getAncestors(["doc1"])
            .then(ancestors => expect(ancestors.toDocumentAncestors(false)).toEqual({doc1: ["doc2"], doc2: ["doc3"], doc3: []}));
    });
    it("should get the right ancestor, 2 levels case with redundancy", () => {
        const fakeTree = Map({
            "doc1": [{id: "doc2", isHidden: false, isDeleted: false}, {id: "doc3", isHidden: false, isDeleted: false}],
            "doc2": [{id: "doc3", isHidden: false, isDeleted: false}]
        });
        const builder = new MemoryAncestorBuilder(fakeTree);
        return builder.getAncestors(["doc1"])
            .then(ancestors => expect(ancestors.toDocumentAncestors(false)).toEqual({doc1: ["doc2", "doc3"], doc2: ["doc3"], doc3: []}));
    });
    it("should get the right ancestor, 2 levels case with redundancy", () => {
        const fakeTree = Map({
            "doc1": [{id: "doc2", isHidden: true, isDeleted: false}, {id: "doc3", isHidden: false, isDeleted: false}],
            "doc2": [{id: "doc3", isHidden: false, isDeleted: false}]
        });
        const builder = new MemoryAncestorBuilder(fakeTree);
        return builder.getAncestors(["doc1"])
            .then(ancestors => expect(ancestors.toDocumentAncestors(true)).toEqual({doc1: ["doc3"], doc3: []}));
    });
});