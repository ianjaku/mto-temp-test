import objectDiff from "../../../src/lib/diff";

describe("objectDiff", () => {
    it("returns {} when both are {}", () => {
        expect(
            objectDiff({}, {})
        ).toEqual({});
    });

    it("returns left addition", () => {
        expect(
            objectDiff({ foo: "bar" }, {})
        ).toEqual({ foo: ["bar", undefined] });
    });

    it("returns right addition", () => {
        expect(
            objectDiff({}, { foo: "bar" })
        ).toEqual({ foo: [undefined, "bar"] });
    });

    it("returns {} when left equals right", () => {
        expect(
            objectDiff({ foo: "bar" }, { foo: "bar" })
        ).toEqual({});
    });

    it("compares arrays", () => {
        expect(
            objectDiff({ foo: [0, "bar"] }, { foo: [0, "abc"] })
        ).toEqual({ foo: [[0, "bar"], [0, "abc"]] });
    });
});