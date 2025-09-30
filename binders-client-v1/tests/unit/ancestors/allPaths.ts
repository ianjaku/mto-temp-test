import { getAllPathsToRootCollection } from "../../../src/ancestors";

describe("getAllPathsToRootCollection", () => {
    it("returns a single path for the root", () => {
        const root = "root";
        const ancestors = { [root]: [] };
        const result = getAllPathsToRootCollection(root, ancestors);
        expect(result).toEqual([ [root] ]);
    });

    it("returns a single path for a child of the root", () => {
        const root = "root";
        const child = "child";
        const ancestors = { [root]: [], [child]: [root] };
        const result = getAllPathsToRootCollection(child, ancestors);
        expect(result).toEqual([ [root, child] ]);
    });

    it("returns two paths for a simple instance", () => {
        const root = "root";
        const L1A = "L1A";
        const L1B = "L1B";
        const L2A = "L2A";
        const L2B = "L2B";
        const ancestors = {
            [root]: [],
            [L1A]: [root],
            [L1B]: [root],
            [L2A]: [L1A, L1B],
            [L2B]: [L1A]
        };
        const resultL2B = getAllPathsToRootCollection(L2B, ancestors);
        expect(resultL2B).toEqual([
            [root, L1A, L2B]
        ]);
        const resultL2A = getAllPathsToRootCollection(L2A, ancestors);
        expect(resultL2A).toEqual([
            [root, L1A, L2A],
            [root, L1B, L2A]
        ]);
    });

    it ("returns multiple paths for a complex instance", () => {
        const root = "root";
        const L1A = "L1A";
        const L1B = "L1B";
        const L2A = "L2A";
        const L2B = "L2B";
        const L3A = "L3A";
        const L3B = "L3B";
        const ancestors = {
            [root]: [],
            [L1A]: [root],
            [L1B]: [root],
            [L2A]: [L1A, L1B],
            [L2B]: [L1A],
            [L3A]: [L2A, L2B],
            [L3B]: [L2A]
        };
        const resultL3A = getAllPathsToRootCollection(L3A, ancestors);
        expect(resultL3A).toEqual([
            [root, L1A, L2A, L3A],
            [root, L1A, L2B, L3A],
            [root, L1B, L2A, L3A]
        ]);
        const resultL3B = getAllPathsToRootCollection(L3B, ancestors);
        expect(resultL3B).toEqual([
            [root, L1A, L2A, L3B],
            [root, L1B, L2A, L3B]
        ]);
    });
});

