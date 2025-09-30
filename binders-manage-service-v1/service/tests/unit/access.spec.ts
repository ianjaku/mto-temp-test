import { MockProxy, mock } from "jest-mock-extended";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { PassportConfiguration } from "@binders/binders-service-common/lib/authentication/middleware";
import { UiErrorCode } from "@binders/client/lib/errors/codes";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { requireProductionAccount } from "../../src/access";

describe("manage access control", () => {
    let azClient: MockProxy<AuthorizationServiceClient>;
    let passportConfig: MockProxy<PassportConfiguration<string>>;

    beforeEach(() => {
        azClient = mockWithFailure("AuthorizationServiceClient");
        passportConfig = mockWithFailure("PassportConfiguration");
    });

    describe("anonymous access", () => {
        it("allows access to public path", async () => {
            const requestValidation = requireProductionAccount(azClient, { publicPath: "/assets" });
            const result = await requestValidation(passportConfig, { path: "/assets" } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("allows access to passport routes", async () => {
            passportConfig.routes.loginRoute = "/login"
            passportConfig.routes.logoutRoute = "/logout"
            const requestValidation = requireProductionAccount(azClient, { publicPath: "/assets" });
            const result = await requestValidation(passportConfig, { path: "/login" } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("denies access to other passport routes", async () => {
            const requestValidation = requireProductionAccount(azClient, { publicPath: "/assets" });
            const result = await requestValidation(passportConfig, { path: "/signup" } as WebRequest)
            expect(result.get()).toBe(UiErrorCode.loginToAccess);
        });
    });

    describe("authenticated access", () => {
        it("allows access to users that can access backend", async () => {
            azClient.canAccessBackend.calledWith("uid-0").mockResolvedValueOnce(true);
            const requestValidation = requireProductionAccount(azClient, { publicPath: "/assets" });
            const result = await requestValidation(passportConfig, { path: "/", user: { userId: "uid-0" } } as WebRequest)
            expect(result.isNothing()).toBe(true);
        });
        it("denies access to users that cannot access backend", async () => {
            azClient.canAccessBackend.calledWith("uid-0").mockResolvedValueOnce(false);
            const requestValidation = requireProductionAccount(azClient, { publicPath: "/assets" });
            const result = await requestValidation(passportConfig, { path: "/", user: { userId: "uid-0" } } as WebRequest)
            expect(result.get()).toBe(UiErrorCode.noAccessManage);
        });
    });
});

const mockWithFailure = <T>(name: string) => mock<T>({} as never, {
    fallbackMockImplementation: (...params: unknown[]) => {
        throw new Error(`[${name}] Called method was not mocked when called with: ` + params);
    }
});

