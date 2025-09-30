import {
    isValidPhoneNumber
} from "../../../../src/documents/Composer/components/BinderLanguage/TextEditor/helpers";

describe("isValidPhoneNumber", () => {
    it("detects valid phone numbers", () => {
        const validPhoneNumbers = [
            "61234567890",
            "123 456 7890",
            "198-765-4321",
            "+4915123456789",
            "+44 1632 960961",
            "+1-415-555-2671",
        ];
        for (const phoneNumber of validPhoneNumbers) {
            expect(isValidPhoneNumber(phoneNumber)).toBe(true);
        }
    });

    it("detects invalid phone numbers", () => {
        const invalidPhoneNumbers = [
            "",
            "    ",
            "6123456a",
            "123 456+7890",
            "+-",
            "-123",
            "123-",
        ];
        for (const phoneNumber of invalidPhoneNumbers) {
            expect(isValidPhoneNumber(phoneNumber)).toBe(false);
        }
    });
})