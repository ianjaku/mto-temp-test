import { getClosestAncestorMatch, hasAtLeastOneReadableParentPath } from "../../../src/ancestors";

describe("getClosestAncestorMatch", () => {
    test("basics", () => {
        const result = getClosestAncestorMatch(
            {
                ["doc-1"]: ["col-1deep"],
                ["col-1deep"]: ["rootcol"],
                ["rootcol"]: [],
            },
            ["doc-1"],
            [],
            candidate => candidate === "col-1deep",
        );
        expect(result).toBe("col-1deep");
    });
    test("multiple matches", () => {
        const ancestors = {
            ["doc-1"]: ["colA-1deep", "colB-1deep"],
            ["colA-1deep"]: ["rootcol"],
            ["colB-1deep"]: ["rootcol"],
            ["rootcol"]: [],
        };
        const firstMatch = getClosestAncestorMatch(
            ancestors,
            ["doc-1"],
            [],
            candidate => candidate === "colA-1deep",
        );
        const secondMatch = getClosestAncestorMatch(
            ancestors,
            ["doc-1"],
            [],
            candidate => candidate === "colB-1deep",
        );
        const noMatch = getClosestAncestorMatch(
            ancestors,
            ["doc-1"],
            [],
            candidate => candidate === "colC-1deep",
        );
        expect(firstMatch).toBe("colA-1deep");
        expect(secondMatch).toBe("colB-1deep");
        expect(noMatch).toBe(undefined);
    });

    test("prefers closer ancestors", () => {
        const predicateMatchers = ["colA-1deep", "colB-1deep"];
        const result1 = getClosestAncestorMatch(
            {
                ["doc-1"]: ["colA-2deep", "colB-3deep"],
                ["colA-2deep"]: ["colA-1deep"],
                ["colA-1deep"]: ["rootcol"],
                ["colB-3deep"]: ["colB-2deep"],
                ["colB-2deep"]: ["colB-1deep"],
                ["colB-1deep"]: ["rootcol"],
                ["rootcol"]: [],
            },
            ["doc-1"],
            [],
            candidate => predicateMatchers.includes(candidate),
        );
        expect(result1).toBe("colA-1deep");
        // reverse order of direct parents to ensure it doesn't matter
        const result2 = getClosestAncestorMatch(
            {
                ["doc-1"]: ["colB-3deep", "colA-2deep"],
                ["colA-2deep"]: ["colA-1deep"],
                ["colA-1deep"]: ["rootcol"],
                ["colB-3deep"]: ["colB-2deep"],
                ["colB-2deep"]: ["colB-1deep"],
                ["colB-1deep"]: ["rootcol"],
                ["rootcol"]: [],
            },
            ["doc-1"],
            [],
            candidate => predicateMatchers.includes(candidate),
        );
        expect(result2).toBe("colA-1deep");
    });

    test("application: hasAtLeastOneReadableParentPath", () => {
        const ancestors = {
            ["doc-1"]: ["colA-1deep", "colB-1deep"],
            ["doc-2"]: ["colC-1deep"],
            ["colA-1deep"]: ["rootcol"],
            ["colB-1deep"]: ["rootcol"],
            ["colC-1deep"]: ["rootcol"],
            ["rootcol"]: [],
        };
        const readableItems = ["colA-1deep"];
        const shouldMatch = hasAtLeastOneReadableParentPath(
            ancestors,
            ["doc-1"],
            [],
            readableItems,
        );
        const shouldNotMatch = hasAtLeastOneReadableParentPath(
            ancestors,
            ["doc-2"],
            [],
            readableItems,
        );
        expect(shouldMatch).toBe(true);
        expect(shouldNotMatch).toBe(false);
    });
});

