import { BCryptPasswordHash } from "../../../src/credentialservice/bcrypthash";

describe("bcrypt hash", () => {
    it("creates a hash and correctly validates", () => {
        const password = "dummyPassword";
        return BCryptPasswordHash.create(password, 5)
            .then(hash => {
                return hash.validate(password);
            })
            .then(isValid => {
                expect(isValid).toEqual(true);
            });
    });

    it("creates a hash and correctly fails", () => {
        const password = "dummyPassword";
        const wrongPassword = "wrongPassword";
        return BCryptPasswordHash.create(password, 5)
            .then(hash => {
                return hash.validate(wrongPassword);
            })
            .then(isValid => {
                expect(isValid).toEqual(false);
            });
    });
});
