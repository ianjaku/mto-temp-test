/**
 * @jest-environment jsdom
 */
import { cleanESQuery } from "../../../src/util/elastic";

describe("cleanESQuery", () =>{
    it("cleans empty string", () => {
        expect(cleanESQuery("")).toEqual("");
    });
    it("does not clean string with \"", () => {
        expect(cleanESQuery("a\"b")).toEqual("a\"b");
    });
    it("cleans string with ^", () => {
        expect(cleanESQuery("a^b")).toEqual("a b");
    });
    it("cleans string with /", () => {
        expect(cleanESQuery("a/b")).toEqual("a b");
    });
    it("cleans string with \\", () => {
        expect(cleanESQuery("a\\b")).toEqual("a b");
    });
    it("cleans string with #", () => {
        expect(cleanESQuery("a#b")).toEqual("a b");
    });
    it("cleans string with ()", () => {
        expect(cleanESQuery("a(b)c")).toEqual("a b c");
    });
    it("cleans multiple quotes", () => {
        expect(cleanESQuery("\"\"a\"\"")).toEqual("\"a\"");
    });
    it("unifies exotic quotes", () => {
        expect(cleanESQuery("„a“")).toEqual("\"a\"");
    });
    it("unifies exotic quotes", () => {
        expect(cleanESQuery("‟a”")).toEqual("\"a\"");
    });
    it("unifies all exotic quotes", () => {
        expect(cleanESQuery("«‹»›„“‟”＂\"❝❞⹂〝〞〟❮❯")).toEqual("\"");
    });
    it("does not clean string with other special chars", () => {
        expect(cleanESQuery("a$b.c+d-e")).toEqual("a$b.c+d-e");
    });
    it("keeps single quotes", () => {
        expect(cleanESQuery("'a'")).toEqual("'a'");
    });
});