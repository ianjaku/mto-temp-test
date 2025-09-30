import {
    safeJsonParse
} from "@binders/client/lib/util/json";

describe("safeJsonParse cases", () => {
    it("should correctly parse a valid json", () => {
        const json = "{\"key\": \"value\"}";
        const result = safeJsonParse(json);
        expect(result).toEqual({ key: "value" });
    });
    it("should return null for an invalid json", () => {
        const json = "{\"key\": \"value\"";
        const result = safeJsonParse(json);
        expect(result).toBeNull();
    });
    it("should use the provided logger to log an error if one is thrown", () => {
        const json = "{\"key\": \"value\"";
        const logger = { error: jest.fn() };
        safeJsonParse(json, logger);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to parse JSON"));
    });
});