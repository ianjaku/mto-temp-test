import { Either } from "../../../src/monad";

test("either monad", () => {
    const leftTest = Either.left("someString");
    expect(leftTest.isLeft()).toBe(true);
});

it("constructs a right", () => {
    const rightTest = Either.right("someString");
    expect(rightTest.isRight()).toBe(true);
});

it("lifts correctly (left)", () => {
    const leftTest = Either.left("someString");
    const afterLift = leftTest.lift(() => "transformed");
    expect(afterLift.isLeft()).toBe(true);
    const matched = afterLift.caseOf({
        left: () => true,
        right: () => false
    });
    expect(matched).toBe(true);
});
it("lifts correctly (right)", () => {
    const rightTest = Either.right("someString");
    const afterLift = rightTest.lift(() => "transformed");
    expect(afterLift.isRight()).toBe(true);
    const matched = afterLift.caseOf({
        left: () => false,
        right: y => y === "transformed"
    });
    expect(matched).toBe(true);
});
it("compares correctly", () => {
    const either1 = Either.right("value");
    const either2 = Either.right("another value");
    const either3 = Either.right("value");
    expect(either1.equals(either1)).toBe(true);
    expect(either1.equals(either2)).toBe(false);
    expect(either1.equals(either3)).toBe(true);

    const either4 = Either.left("error");
    const either5 = Either.left("another error");
    const either6 = Either.left("error");
    expect(either4.equals(either4)).toBe(true);
    expect(either4.equals(either5)).toBe(false);
    expect(either4.equals(either6)).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(either1.equals(either4 as any)).toBe(false);
});
