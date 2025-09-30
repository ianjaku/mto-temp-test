import { fillPathParams } from "@binders/client/lib/clients/client";

describe("api client", () => {
    it("should not touch path without params", () => {
        const toTest = "/admin/account";
        const rewritten = fillPathParams(toTest, { account: "binders" });
        expect(rewritten).toEqual(toTest);
    });

    it("should replace a single param", () => {
        const toTest = "/admin/:account";
        const rewritten = fillPathParams(toTest, { account: "binders" });
        expect(rewritten).toEqual("/admin/binders");
    });

    it("should replace multiple params", () => {
        const toTest = "/admin/:account/test/:user/go";
        const rewritten = fillPathParams(toTest, { account: "binders", user: "tom" });
        expect(rewritten).toEqual("/admin/binders/test/tom/go");
    });

    it("should replace the same param multiple times", () => {
        const toTest = "/admin/:account/test/:account/go";
        const rewritten = fillPathParams(toTest, { account: "binders", user: "tom" });
        expect(rewritten).toEqual("/admin/binders/test/binders/go");
    });
});
