import {
    MAX_SLUG_SUFFIX_LENGTH,
    MIN_SLUG_SUFFIX_LENGTH,
    SLUG_STYLE_SUFFIX_REGEX
} from "@binders/client/lib/util/slugify";

describe("slugify exposed regex", () => {
    it("should match slugs with correct suffix", () => {
        const slugs = [
            `shortest-slug-${"1".repeat(MIN_SLUG_SUFFIX_LENGTH)}`,
            `longest-slug-${"9".repeat(MAX_SLUG_SUFFIX_LENGTH)}`,
            "some-slug-121456",
        ];
        const nonSlugs = [
            `too-short-${"3".repeat(MIN_SLUG_SUFFIX_LENGTH - 1)}`,
            `too-long-${"6".repeat(MAX_SLUG_SUFFIX_LENGTH + 1)}`,
            "not-this-one-1",
            "or-this",
        ];
        const potentialSlugs = [...nonSlugs, ...slugs];

        const matchedSlugs = potentialSlugs.filter(slug => SLUG_STYLE_SUFFIX_REGEX.test(slug));

        expect(matchedSlugs).toEqual(slugs);
    });
})