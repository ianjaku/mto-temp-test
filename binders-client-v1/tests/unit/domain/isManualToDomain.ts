import { isManualToDomain } from "../../../src/util/domains"


describe("Test isManualToDomain", () => {
    test("basic case", () => {
        expect(isManualToDomain("demo.manual.to")).toBe(true);
    });
    test("no subdomain", () => {
        expect(isManualToDomain("manual.to")).toBe(false);
    });
    test("random string", () => {
        expect(isManualToDomain("demo")).toBe(false);
    });
});