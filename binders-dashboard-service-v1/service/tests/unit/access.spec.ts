import { MockProxy, mock } from "jest-mock-extended";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors/codes";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { requestValidation } from "../../src/access";

describe("dashboard access control", () => {
    let azClient: MockProxy<AuthorizationServiceClient>;
    let passportConfig: MockProxy<PassportConfiguration<string>>;

    beforeEach(() => {
        azClient = mockWithFailure("AuthorizationServiceClient");
        passportConfig = mockWithFailure("PassportConfiguration");
    });

    describe("anonymous access", () => {
        it("allows access to public path", async () => {
            const validate = requestValidation(azClient, { publicPath: "/assets" });
            const result = await validate(passportConfig, { path: "/assets" } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("allows access to passport routes", async () => {
            passportConfig.routes.loginRoute = "/login"
            passportConfig.routes.logoutRoute = "/logout"
            const validate = requestValidation(azClient, { publicPath: "/assets" });
            const result = await validate(passportConfig, { path: "/login" } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("denies access to other passport routes", async () => {
            const validate = requestValidation(azClient, { publicPath: "/assets" });
            const result = await validate(passportConfig, { path: "/signup" } as WebRequest)
            expect(result.get()).toBe(UiErrorCode.loginToAccess);
        });
    });

    describe("authenticated access", () => {
        it("allows access to users that can access backend", async () => {
            azClient.canAccessBackend.calledWith("uid-0").mockResolvedValueOnce(true);
            const validate = requestValidation(azClient, { publicPath: "/assets" });
            const result = await validate(passportConfig, { path: "/", user: { userId: "uid-0" } } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("denies access to users that cannot access backend", async () => {
            azClient.canAccessBackend.calledWith("uid-0").mockResolvedValueOnce(false);
            const validate = requestValidation(azClient, { publicPath: "/assets" });
            const result = await validate(passportConfig, { path: "/", user: { userId: "uid-0" } } as WebRequest)
            expect(result.get()).toBe(UiErrorCode.noAccessDashboard);
        });
    });
});

const mockWithFailure = <T>(name: string) => mock<T>({} as never, {
    fallbackMockImplementation: (...params: unknown[]) => {
        throw new Error(`[${name}] Called method was not mocked when called with: ` + params);
    }
});

