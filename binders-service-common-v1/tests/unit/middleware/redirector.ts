import {
    DomainRedirectConfigs,
    RenamedItemRule
} from "@binders/binders-service-common/lib/middleware/config";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { DomainRedirector } from "../../../src/middleware/redirector";
import { READER_ROUTES_PREFIXES } from "@binders/client/lib/util/readerRoutes";

describe("Domain Redirector", () => {
    it.each([
        Application.DASHBOARD,
        Application.PARTNERS,
        Application.MANAGE,
    ])("throws when application is neither editor nor reader", (application: Application) => {
        expect(() => new DomainRedirector(() => ({}), application, "production"))
            .toThrow();
    })
});

describe("Domain Redirector in production", () => {
    const provider: () => DomainRedirectConfigs = () => ({
        "test.manual.to": {
            targetDomain: "redirected.manual.to",
            rules: {
                "movedId": {
                    type: "move",
                    newParent: "newParent"
                },
                "deepMoveId": {
                    type: "move",
                    newParent: "firstParent/secondParent"
                },
                "renamedId": {
                    type: "rename",
                    newName: "newNameId",
                },
                "invalidActionId": {
                    type: "invalid",
                } as unknown as RenamedItemRule
            }
        },
        "test2.manual.to": {
            targetDomain: "google.com",
            rules: {}
        },
        "same.manual.to": {
            targetDomain: "same.manual.to",
            rules: {}
        }
    });

    describe.each([
        { application: Application.EDITOR, originalHostname: "test.editor.manual.to", expectedHostname: "redirected.editor.manual.to" },
        { application: Application.READER, originalHostname: "test.manual.to", expectedHostname: "redirected.manual.to" },
    ])("when application is $application and originalHostname is $originalHostname and expectedHostname is $expectedHostname", ({ application, originalHostname, expectedHostname }) => {
        const redirector = new DomainRedirector(provider, application, "production");

        it("throws on invalid target domain", async () => {
            await expect(() => redirector.transformUrl("test2.manual.to", originalHostname, ""))
                .rejects.toThrow();
        });
        it("throws on invalid same source and target domain", async () => {
            await expect(() => redirector.transformUrl("same.manual.to", originalHostname, ""))
                .rejects.toThrow();
        });

        it("throws on unknown rule", async () => {
            await expect(() => redirector.transformUrl("test.manual.to", originalHostname, "/invalidActionId"))
                .rejects.toThrow();
        });

        it("returns undefined when domain is unknown", async () => {
            const redirectUrl = await redirector.transformUrl("unknown.manual.to", originalHostname, "");
            expect(redirectUrl).toBeUndefined();
        });

        it("changes base domain when path is empty", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/`);
        });

        it("changes base domain and not the path", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "/unchanged/path?something=else");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/unchanged/path?something=else`);
        });

        it("changes the base domain and the path for moved items", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "/movedId?something=else");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/newParent/movedId?something=else`);
        });

        it("changes the base domain and the path for moved items when not in root", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "/originalParent/deepMoveId?something=else");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/firstParent/secondParent/deepMoveId?something=else`);
        });

        it("changes the base domain and the path when using known routes", async () => {
            for (const route of READER_ROUTES_PREFIXES) {
                const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, `/${route}/movedId?something=else`);
                expect(redirectUrl).toEqual(`https://${expectedHostname}/${route}/newParent/movedId?something=else`);
            }
        });

        it("changes the base domain and renamed the item in the path", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "/renamedId?something=else");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/newNameId?something=else`);
        });

        it("changes the base domain and renamed the item in the path when not in root", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, "/parent/renamedId?something=else");
            expect(redirectUrl).toEqual(`https://${expectedHostname}/parent/newNameId?something=else`);
        });

        it("changes the base domain and renamed the item in the path using known routes", async () => {
            for (const route of READER_ROUTES_PREFIXES) {
                const redirectUrl = await redirector.transformUrl("test.manual.to", originalHostname, `/${route}/renamedId?something=else`);
                expect(redirectUrl).toEqual(`https://${expectedHostname}/${route}/newNameId?something=else`);
            }
        });
    })
});

describe("Domain Redirector on staging", () => {
    describe.each([
        { application: Application.EDITOR, hostname: "some-domain.editor.staging.manual.to" },
        { application: Application.READER, hostname: "some-domain.staging.manual.to" },
    ])("when application $application and hostname $hostname",  ({ application, hostname }) => {
        const provider: () => DomainRedirectConfigs = () => ({
            "test.manual.to": {
                targetDomain: "redirected.manual.to",
                rules: {
                    "movedId": {
                        type: "move",
                        newParent: "newParent"
                    },
                    "renamedId": {
                        type: "rename",
                        newName: "newNameId",
                    }
                }
            }
        });
        const redirector = new DomainRedirector(provider, application, "staging");

        it("resolves empty relative path urls", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "?domain=test.manual.to")
            expect(redirectUrl).toEqual(`https://${hostname}/?domain=redirected.manual.to`);
        });

        it("resolves moves", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "/movedId?domain=test.manual.to")
            expect(redirectUrl).toEqual(`https://${hostname}/newParent/movedId?domain=redirected.manual.to`);
        });

        it("resolves redirects", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "/renamedId?domain=test.manual.to")
            expect(redirectUrl).toEqual(`https://${hostname}/newNameId?domain=redirected.manual.to`);
        });
    })
});

describe("Domain Redirector on local dev", () => {
    describe.each([
        { application: Application.EDITOR, hostname: "localhost", port: 30006 },
        { application: Application.READER, hostname: "172.17.0.1", port: 30014 },
    ])("when application $application and hostname $hostname",  ({ application, hostname, port }) => {
        const provider: () => DomainRedirectConfigs = () => ({
            "test.manual.to": {
                targetDomain: "redirected.manual.to",
                rules: {
                    "movedId": {
                        type: "move",
                        newParent: "newParent"
                    },
                    "renamedId": {
                        type: "rename",
                        newName: "newNameId",
                    }
                }
            }
        });
        const redirector = new DomainRedirector(provider, application, "dev");

        it("resolves empty relative path urls", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "?domain=test.manual.to")
            expect(redirectUrl).toEqual(`http://${hostname}:${port}/?domain=redirected.manual.to`);
        });

        it("resolves moves", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "/movedId?domain=test.manual.to")
            expect(redirectUrl).toEqual(`http://${hostname}:${port}/newParent/movedId?domain=redirected.manual.to`);
        });

        it("resolves redirects", async () => {
            const redirectUrl = await redirector.transformUrl("test.manual.to", hostname, "/renamedId?domain=test.manual.to")
            expect(redirectUrl).toEqual(`http://${hostname}:${port}/newNameId?domain=redirected.manual.to`);
        });
    })
});