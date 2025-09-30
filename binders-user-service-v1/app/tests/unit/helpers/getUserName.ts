import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";

describe("getUserName", () => {
    it("should return user display name when available", () => {
        const users = [
            { login: "testuser", displayName: "Test User" },
            { login: "testuser", displayName: "Test User", firstName: "", lastName: "" },
            { login: "testuser", displayName: "Test User", firstName: "Not", lastName: "User" },
        ];
        for (const user of users) {
            expect(getUserName(user)).toBe("Test User");
        }
    });

    it("should return a combination of first and last name when display name is missing", () => {
        const users = [
            { login: "testuser", firstName: "Test User" },
            { login: "testuser", firstName: "Test User", lastName: undefined },
            { login: "testuser", firstName: "Test User", lastName: "" },
            { login: "testuser", firstName: "Test User ", lastName: "   " },
            { login: "testuser", firstName: "    ", lastName: "  Test User" },
            { login: "testuser", firstName: "", lastName: "Test User" },
            { login: "testuser", firstName: undefined, lastName: "Test User" },
            { login: "testuser", lastName: "Test User" },
        ];
        for (const user of users) {
            expect(getUserName(user)).toBe("Test User");
        }
    });

    it("should return user login if no other name is available", () => {
        const users = [
            { login: "testuser" },
            { login: "testuser", displayName: "", firstName: undefined },
        ];
        for (const user of users) {
            expect(getUserName(user)).toBe("testuser");
        }
    });

    it("should return empty string if no name is available", () => {
        expect(getUserName({})).toBe("");
    });
});

