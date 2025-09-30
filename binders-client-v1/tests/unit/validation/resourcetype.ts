import { ResourceType } from "../../../src/clients/authorizationservice/v1/contract";
import { validateResourceType } from "../../../src/clients/authorizationservice/v1/validation";

test("a valid resource type should work", () => {
    const validationErrors = validateResourceType(ResourceType.ACCOUNT);
    expect(validationErrors).toHaveLength(0);
});

test("a matching string name should fail", () => {
    const validationErrors = validateResourceType("ACCOUNT");
    expect(validationErrors).toHaveLength(1);
});

test("a missmatch number should fail", () => {
    const validationErrors = validateResourceType(123);
    expect(validationErrors).toHaveLength(1);
});

test("a missmatch string name should fail", () => {
    const validationErrors = validateResourceType("SOME_STRING");
    expect(validationErrors).toHaveLength(1);
});
