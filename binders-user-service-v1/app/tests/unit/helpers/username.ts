import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";

describe("buildUserName", () => {
    it("should return user login if no other name is available", () => {
        const user = { id: "1", login: "testuser" };
        expect(buildUserName(user)).toBe("testuser");
    });

    it("should return user display name if available", () => {
        const user = { id: "1", login: "testuser", displayName: "Test User" };
        expect(buildUserName(user)).toBe("Test User");
    });

    it("should return user first name if available and preferFirstName option is true", () => {
        const user = { id: "1", login: "testuser", firstName: "Test", lastName: "User" };
        expect(buildUserName(user, { preferFirstName: true })).toBe("Test");
    });

    it("should return user first name and last name if available and preferFirstName option is false", () => {
        const user = { id: "1", login: "testuser", firstName: "Test", lastName: "User" };
        expect(buildUserName(user)).toBe("Test User");
    });

    it("should return empty string if no name is available and noFallbackToId option is true", () => {
        const user = { id: "1" };
        expect(buildUserName(user, { noFallbackToId: true })).toBe("");
    });

    it("should return user id if no name is available and noFallbackToId option is false", () => {
        const user = { id: "1" };
        expect(buildUserName(user)).toBe("1");
    });

});

