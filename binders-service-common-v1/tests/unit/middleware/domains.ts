import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { WebRequest } from "../../../src/middleware/request";
import { getDomainFromRequest } from "../../../src/util/domains";
import { isProduction } from "@binders/client/lib/util/environment";

const TEST_DOMAIN = "test.manual.to";

// Only isProduction is used, hence we're overloading only that one
jest.mock("@binders/client/lib/util/environment", () => ({
    isProduction: jest.fn()
}))

describe("getDomainFromRequest on production", () => {
    describe.each([
        { application: Application.EDITOR, hostname: "test.editor.manual.to", expectedDomain: TEST_DOMAIN },
        { application: Application.READER, hostname: "test.manual.to", expectedDomain: TEST_DOMAIN },
        { application: Application.MANAGE, hostname: "manage.binders.media", expectedDomain: "manage.binders.media" },
        { application: Application.DASHBOARD, hostname: "dashboard.binders.media", expectedDomain: "dashboard.binders.media" },
        { application: Application.PARTNERS, hostname: "partners.binders.media", expectedDomain: "partners.binders.media" },
    ])("with application $application and hostname $hostname", ({ application, hostname, expectedDomain }) => {

        beforeAll(() => {
            isProduction.mockImplementation(() => true);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        const req = { hostname } as WebRequest;

        it("Returns full domain for application", () => {
            const domain = getDomainFromRequest(req, application);
            expect(domain).toEqual(expectedDomain);
        });

        it("Returns partial domain for application", () => {
            const domain = getDomainFromRequest(req, application, { returnOnlySubdomain: true });
            expect(domain).toEqual(expectedDomain.split(".").at(0));
        });
    });

    it("resolves on undefined application id", async () => {
        const domain = getDomainFromRequest({ hostname: TEST_DOMAIN } as WebRequest, undefined);
        expect(domain).toEqual(TEST_DOMAIN);
    });
});

describe("getDomainFromRequest on staging", () => {
    describe.each([
        { application: Application.EDITOR, expectedDomain: TEST_DOMAIN },
        { application: Application.READER, expectedDomain: TEST_DOMAIN },
    ])("with application $application and hostname $hostname", ({ application, expectedDomain }) => {

        beforeAll(() => {
            isProduction.mockImplementation(() => false);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        const noDomainReq = {
            hostname: "unused.manual.to",
            query: {}
        } as unknown as WebRequest;

        const req = {
            hostname: "unused.manual.to",
            query: { domain: expectedDomain }
        } as unknown as WebRequest;

        it("Returns default domain for application when doman query param is missing", () => {
            const domain = getDomainFromRequest(noDomainReq, application);
            expect(domain).toEqual("demo.manual.to");
        });

        it("Returns full domain for application", () => {
            const domain = getDomainFromRequest(req, application);
            expect(domain).toEqual(expectedDomain);
        });

        it("Returns partial domain for application", () => {
            const domain = getDomainFromRequest(req, application, { returnOnlySubdomain: true });
            expect(domain).toEqual(expectedDomain.split(".").at(0));
        });
    });

    it("resolves on undefined application id", async () => {
        const domain = getDomainFromRequest({ hostname: TEST_DOMAIN, query: { domain: TEST_DOMAIN } } as unknown as WebRequest, undefined);
        expect(domain).toEqual(TEST_DOMAIN);
    });
});

describe("getDomainFromRequest on dev", () => {
    describe.each([
        { application: Application.EDITOR, expectedDomain: TEST_DOMAIN },
        { application: Application.READER, expectedDomain: TEST_DOMAIN },
    ])("with application $application and hostname $hostname", ({ application, expectedDomain }) => {

        const noDomainReq = {
            hostname: "172.17.0.1",
            query: {}
        } as unknown as WebRequest;

        const req = {
            hostname: "localhost",
            query: { domain: expectedDomain }
        } as unknown as WebRequest;

        beforeAll(() => {
            isProduction.mockImplementation(() => false);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("Returns default domain for application when doman query param is missing", () => {
            const domain = getDomainFromRequest(noDomainReq, application);
            expect(domain).toEqual("demo.manual.to");
        });

        it("Returns full domain for application", () => {
            const domain = getDomainFromRequest(req, application);
            expect(domain).toEqual(expectedDomain);
        });

        it("Returns partial domain for application", () => {
            const domain = getDomainFromRequest(req, application, { returnOnlySubdomain: true });
            expect(domain).toEqual(expectedDomain.split(".").at(0));
        });
    });

    it("resolves on undefined application id", async () => {
        const domain = getDomainFromRequest({ hostname: TEST_DOMAIN, query: { domain: TEST_DOMAIN } } as unknown as WebRequest, undefined);
        expect(domain).toEqual(TEST_DOMAIN);
    });
});