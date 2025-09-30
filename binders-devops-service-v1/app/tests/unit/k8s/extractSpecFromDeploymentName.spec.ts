import { extractServiceFromDeploymentName } from "../../../src/lib/bindersenvironment"

describe("extractServiceFromDeploymentName", () => {
    it("should extract the service name correctly", () => {
        const testCases = [
            {
                input: "develop-editor-v2-develop-deployment",
                expectedResult: "editor"
            },
            {
                input: "rel-november-24-image-v1-ba837784-deployment",
                expectedResult: "image"
            },
            {
                input: "rel-november-24-editor-v2-rel-november-24-deployment",
                expectedResult: "editor"
            },
        ]

        for (const tcase of testCases) {
            const result = extractServiceFromDeploymentName(tcase.input)
            expect(result).toEqual(tcase.expectedResult)
        }
    })

    it("should throw an error for invalid deployment names", () => {
        const invalidFormatError = "Invalid deployment name format";
        const versionNotFoundError = "Version not found in deployment name or invalid format"
        const testCases = [
            {
                input: "randomstring",
                expectedError: invalidFormatError
            },
            {
                input: "develop-deployment",
                expectedError: versionNotFoundError
            }
        ];

        for (const tcase of testCases) {
            expect(() => extractServiceFromDeploymentName(tcase.input)).toThrow(tcase.expectedError);
        }
    });

})