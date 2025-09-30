import { extractDomainPrefix } from "../../../src/views/header/util";

function testCase(domain, expectedPrefix) {
    const prefix = extractDomainPrefix(domain);
    expect(prefix).toEqual(expectedPrefix);
}

test("It extracts the right prefix", () => {
    testCase("demo.manual.to", "demo.");
    testCase("binder.demo.manual.to", "binder.demo.");
    testCase("tech_eu.manual.to", "tech_eu.");
});
