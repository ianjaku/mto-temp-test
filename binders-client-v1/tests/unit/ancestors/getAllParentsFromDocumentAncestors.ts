import { getAllParentsFromDocumentAncestors } from "../../../src/clients/repositoryservice/v3/helpers";


describe("getAllParentsFromDocumentAncestors", () => {
    it("returns an empty list when there are no ancestors for the given item", () => {
        const ancestors = { "otherItem": ["test"], "thisItem": [] };
        const result = getAllParentsFromDocumentAncestors("thisItem", ancestors);
        expect(result.length).toBe(0);
    });

    it("returns an empty list when the itemId does not exist in the ancestors", () => {
        const ancestors = { "otherItem": ["test"] };
        const result = getAllParentsFromDocumentAncestors("thisItem", ancestors);
        expect(result.length).toBe(0);
    });

    it("retuns all items from direct ancestor to furthest away ancestor", () => {
        const ancestors = {
            "otherItem": ["something"],
            "thisItem": ["parentItem"],
            "parentItem": ["grandParentItem"],
            "grandParentItem": ["root"]
        };
        const result = getAllParentsFromDocumentAncestors("thisItem", ancestors);
        expect(result).toEqual(["parentItem", "grandParentItem", "root"]);
    });
});