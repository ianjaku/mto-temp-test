import { add, sub } from "date-fns";
import { Maybe } from "../../../src/monad";
import { maybeMinDate } from "../../../src/date/maybeDateFns";

describe("maybeMinDate", () => {
    it("selects Nothing from []", () => {
        expect(
            maybeMinDate([])
        ).toEqual(Maybe.nothing());
    });

    it("selects Nothing from [Nothing, Nothing]", () => {
        expect(
            maybeMinDate([Maybe.nothing(), Maybe.nothing()])
        ).toEqual(Maybe.nothing());
    });

    it("selects Just in [Nothing, Just, Nothing]", () => {
        const now = new Date();
        expect(
            maybeMinDate([Maybe.nothing(), Maybe.just(now), Maybe.nothing()])
        ).toEqual(Maybe.just(now));
    });

    it("selects Just from [Nothing, Just, Nothing]", () => {
        const now = new Date();
        expect(
            maybeMinDate([Maybe.nothing(), Maybe.just(now), Maybe.nothing()])
        ).toEqual(Maybe.just(now));
    });

    it("selects the min date", () => {
        const now = new Date();
        const before = sub(now, { days: 1 });
        const after = add(now, { days: 1 });
        expect(
            maybeMinDate([Maybe.just(now), Maybe.nothing(), Maybe.just(before), Maybe.just(after)])
        ).toEqual(Maybe.just(before));
    });
});