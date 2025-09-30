import { Maybe } from "../../../src/monad";
import { sum } from "ramda";

describe("constructor", () => {
    test("just", () => {
        const withValue = Maybe.just("value");
        expect(withValue.isJust()).toBe(true);
        expect(withValue.isNothing()).toBe(false);
    });

    test("nothing", () => {
        const withoutValue = Maybe.nothing();
        expect(withoutValue.isJust()).toBe(false);
        expect(withoutValue.isNothing()).toBe(true);
    });
});

describe("equals", () => {
    test("nothing", () => {
        const stringWithoutValue = Maybe.nothing();
        const otherStringWithoutValue = Maybe.nothing();
        const someValue = Maybe.just("test");
        expect(stringWithoutValue.equals(otherStringWithoutValue)).toBe(true);
        expect(stringWithoutValue.equals(someValue)).toBe(false);
    });
    test("just", () => {
        const stringWithoutValue = Maybe.nothing<string>();
        const someValue = Maybe.just("test");
        const otherSomeValue = Maybe.just("test");
        const thirdSomeValue = Maybe.just("test2");
        expect(someValue.equals(someValue)).toBe(true);
        expect(someValue.equals(otherSomeValue)).toBe(true);
        expect(someValue.equals(thirdSomeValue)).toBe(false);
        expect(someValue.equals(stringWithoutValue)).toBe(false);
    });
});

describe("lift", () => {
    it("maps to nothing", () => {
        const x = Maybe.nothing();
        const f = s => {
            return "prefix_" + s;
        };
        const mapped = x.lift(f);
        expect(mapped.isNothing()).toBe(true);
    });

    it("maps to just", () => {
        const x = Maybe.just("suffix");
        const f = s => {
            return "prefix_" + s;
        };
        const mapped = x.lift(f);
        const expected = Maybe.just("prefix_suffix");
        expect(mapped.equals(expected)).toBe(true);
    });

    it("flatmaps to nothing", () => {
        const x = Maybe.nothing();
        const f = s => {
            return Maybe.just("prefix_" + s);
        };
        const flatMapped = x.lift(f);
        expect(flatMapped.isNothing()).toBe(true);
    });

    it("flatmaps to just", () => {
        const x = Maybe.just("suffix");
        const f = s => {
            return Maybe.just("prefix_" + s);
        };
        const flatMapped = x.bind(f);
        const expected = Maybe.just("prefix_suffix");
        expect(flatMapped.equals(expected)).toBe(true);
    });
});

describe("caseOf", () => {
    test("just works correctly", () => {
        const toMatch = Maybe.just("string");
        const transformed = toMatch.caseOf({
            just: s => {
                return "prefix_" + s;
            },
            nothing: () => {
                return "nothing";
            }
        });
        expect(transformed).toBe("prefix_string");
    });

    test("nothing works correctly", () => {
        const toMatch = Maybe.nothing();
        const transformed = toMatch.caseOf({
            just: s => {
                return "prefix_" + s;
            },
            nothing: () => {
                return "nothing";
            }
        });
        expect(transformed).toBe("nothing");
    });
})

describe("rejectNothings", () => {
    it("filters an empty array", () => {
        const given = [] as Maybe<number>[];
        const expected = [];
        const result = Maybe.rejectNothings(given);
        expect(result).toEqual(expected);
    });
    it("filters an array with no Nothing", () => {
        const given = [Maybe.just(1), Maybe.just(2)] as Maybe<number>[];
        const expected = [1, 2];
        const result = Maybe.rejectNothings(given);
        expect(result).toEqual(expected);
    });
    it("filters an array with no Just", () => {
        const given = [Maybe.nothing(), Maybe.nothing()] as Maybe<number>[];
        const expected = [];
        const result = Maybe.rejectNothings(given);
        expect(result).toEqual(expected);
    });
    it("filters an array with bth", () => {
        const given = [Maybe.just(1), Maybe.nothing(), Maybe.nothing(), Maybe.just(2)] as Maybe<number>[];
        const expected = [1, 2];
        const result = Maybe.rejectNothings(given);
        expect(result).toEqual(expected);
    });
});

describe("whenBoth", () => {
    it("returns Nothing when one of the arguments is Nothing", () => {
        const expected = Maybe.nothing();
        const result = Maybe.whenBoth(Maybe.just(1), Maybe.nothing(), (a, b) => a + b);
        expect(result).toEqual(expected);
    });
    it("returns Nothing when both of the arguments are Nothing", () => {
        const expected = Maybe.nothing();
        const result = Maybe.whenBoth(Maybe.nothing(), Maybe.nothing(), (a, b) => [a, b]);
        expect(result).toEqual(expected);
    });
    it("returns Just when all arguments are Just", () => {
        const expected = Maybe.just(3);
        const result = Maybe.whenBoth(Maybe.just(1), Maybe.just(2), (a, b) => a + b);
        expect(result).toEqual(expected);
    });
});

describe("whenAll", () => {
    it("returns Nothing when one of the arguments is Nothing", () => {
        const expected = Maybe.nothing();
        const result = Maybe.whenAll([Maybe.just(1), Maybe.nothing<number>()], sum);
        expect(result).toEqual(expected);
    });
    it("returns Nothing when all of the arguments are Nothing", () => {
        const expected = Maybe.nothing();
        const result = Maybe.whenAll([Maybe.nothing<number>(), Maybe.nothing<number>()], sum);
        expect(result).toEqual(expected);
    });
    it("returns Just when all arguments are Just", () => {
        const expected = Maybe.just(3);
        const result = Maybe.whenAll([Maybe.just(1), Maybe.just(2)], sum);
        expect(result).toEqual(expected);
    });
});
