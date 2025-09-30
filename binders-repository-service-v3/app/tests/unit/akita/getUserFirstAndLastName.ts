import { getUserFirstAndLastName } from  "../../../src/scripts/akita/helpers";

describe("Test the getUserFirstAndLastName helper function", () => {

    it("returns first and last name when both are provided", () => {
        const user = {
            firstName: "John",
            lastName: "Doe",
        }
        const [firstName, lastName] = getUserFirstAndLastName(user);
        expect(firstName).toBe("John");
        expect(lastName).toBe("Doe");
    });

    it("falls back to displayName if either is missing, splitting it in multiple parts case it contains spaces", () => {
        const user = {
            firstName: "Jan",
            displayName: "Jan Van Der Doe",
        }
        const [firstName, lastName] = getUserFirstAndLastName(user);
        expect(firstName).toBe("Jan");
        expect(lastName).toBe("Van Der Doe");
    });

    it("falls back to displayName if either is missing, splitting it in two parts case it contains spaces", () => {
        const user = {
            lastName: "Doe",
            displayName: "John Doe",
        }
        const [firstName, lastName] = getUserFirstAndLastName(user);
        expect(firstName).toBe("John");
        expect(lastName).toBe("Doe");
    });

    it("returns what's available for first and last name if either of them is missing + displayName is also missing", () => {
        const user = {
            lastName: "Doe",
        }
        const [firstName, lastName] = getUserFirstAndLastName(user);
        expect(firstName).toBe(undefined);
        expect(lastName).toBe("Doe");
    });

});