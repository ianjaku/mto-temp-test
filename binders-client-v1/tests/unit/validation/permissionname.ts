import { PermissionName } from "../../../src/clients/authorizationservice/v1/contract";
import { validatePermissionName } from "../../../src/clients/authorizationservice/v1/validation";

test("a valid resource type should work", () => {
    const validationErrors = validatePermissionName(PermissionName.EDIT);
    expect(validationErrors).toHaveLength(0);
});

test("a matching string name should fail", () => {
    const validationErrors = validatePermissionName("EDIT");
    expect(validationErrors).toHaveLength(1);
});

test("a missmatch number should fail", () => {
    const validationErrors = validatePermissionName(123);
    expect(validationErrors).toHaveLength(1);
});

test("a missmatch string name should fail", () => {
    const validationErrors = validatePermissionName("SOME_STRING");
    expect(validationErrors).toHaveLength(1);
});
