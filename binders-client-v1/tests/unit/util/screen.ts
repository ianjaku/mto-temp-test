import { scale } from "../../../src/util/screen";

const NO_DIMS = { width: 0, height: 0 };
const SMALL_LANDSCAPE = { width: 400, height: 200 };
const SMALL_PORTRAIT = { width: 200, height: 400 };
const LARGE_LANDSCAPE = { width: 1600, height: 800 };
const LARGE_PORTRAIT = { width: 800, height: 1600 };
const dims = (width: number, height: number) => ({ width, height })

describe("scale", () => {
    describe("empty dimensions", () => {
        it("returns empty dimensions", () => {
            expect(scale({ dims: NO_DIMS, viewport: NO_DIMS, })).toStrictEqual(NO_DIMS);
            expect(scale({ dims: dims(100, 100), viewport: NO_DIMS, })).toStrictEqual(NO_DIMS);
            expect(scale({ dims: NO_DIMS, viewport: dims(100, 100), })).toStrictEqual(NO_DIMS);
        });
    });

    describe("smaller img on bigger screen", () => {
        it("img portrait vw landscape", () => {
            expect(scale({ dims: SMALL_PORTRAIT, viewport: LARGE_LANDSCAPE })).
                toStrictEqual(SMALL_PORTRAIT);
        });
        it("img landscape vw landscape", () => {
            expect(scale({ dims: SMALL_LANDSCAPE, viewport: LARGE_LANDSCAPE })).
                toStrictEqual(SMALL_LANDSCAPE);
        });
        it("img portrait vw portrait", () => {
            expect(scale({ dims: SMALL_PORTRAIT, viewport: LARGE_PORTRAIT })).
                toStrictEqual(SMALL_PORTRAIT);
        });
        it("img landscape vw portrait", () => {
            expect(scale({ dims: SMALL_LANDSCAPE, viewport: LARGE_PORTRAIT }))
                .toStrictEqual(SMALL_LANDSCAPE);
        });
    });

    describe("square viewport", () => {
        describe("overflowing portrait", () => {
            it("overflowing height", () => {
                expect(scale({
                    dims: { width: 60, height: 100 },
                    viewport: { width: 80, height: 80 },
                    preserveAspectRatio: true,
                })).toStrictEqual({
                    width: 80 * 0.6,
                    height: 80,
                });
            });
            it("overflowing both", () => {
                expect(scale({
                    dims: { width: 100, height: 160 },
                    viewport: { width: 80, height: 80 },
                    preserveAspectRatio: true,
                })).toStrictEqual({
                    width: 50,
                    height: 80,
                });
            });
        });
        describe("overflowing landscape", () => {
            it("overflowing width", () => {
                expect(scale({
                    dims: { width: 100, height: 60 },
                    viewport: { width: 80, height: 80 },
                    preserveAspectRatio: true,
                })).toStrictEqual({
                    width: 80,
                    height: 80 * 0.6,
                });
            });
        });
    });

    describe("landscape viewport", () => {
        describe("overflowing portrait", () => {
            it("overflowing height", () => {
                expect(scale({
                    dims: { width: 60, height: 100 },
                    viewport: { width: 160, height: 80 },
                    preserveAspectRatio: true,
                })).toStrictEqual({
                    width: 80 * 0.6,
                    height: 80,
                });
            });
            it("overflowing both", () => {
                expect(scale({
                    dims: { width: 100, height: 160 },
                    viewport: { width: 160, height: 80 },
                    preserveAspectRatio: true,
                })).toStrictEqual({
                    width: 50,
                    height: 80,
                });
            });
        });
    });
});
