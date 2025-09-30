import { parseDeploymentName } from "../../../src/lib/bindersenvironment";

describe("parseDeploymentName", () => {
    it("should parse a deployment name with branch, service, version, and commit ref", () => {
        const result = parseDeploymentName("rel-march-25-image-v1-df0e8afc-deployment");
        expect(result).toEqual({
            branchName: "rel-march-25",
            service: "image",
            version: "v1",
            commitRef: "df0e8afc",
        });
    });

    it("should parse a deployment name with double hypnen service name", () => {
        const result = parseDeploymentName("rel-march-25-public-api-v1-df0e8afc-deployment");
        expect(result).toEqual({
            branchName: "rel-march-25",
            service: "public-api",
            version: "v1",
            commitRef: "df0e8afc",
        });
    });

    it("should throw an error for a non-existent service", () => {
        expect(() => {
            parseDeploymentName("rel-march-25-nonexistent-service-v1-df0e8afc-deployment");
        }).toThrow("Could not parse deployment name with available services");
    });
});
