import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { NodeClientHandler } from "@binders/binders-service-common/lib/apiclient/nodeclient";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { buildBackendSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";

const config = BindersConfig.get();
const jwtSignConfig = buildBackendSignConfig(config);

async function getClient() {
    const nodeRequestHandler = await NodeClientHandler.forBackend(jwtSignConfig, "componenttest")
    return RoutingServiceClient.fromConfig(config, "v1", nodeRequestHandler);
}

const testDomain = "test-account.readerbranding.manual.to";
const testAccountLogo = {
    url: "/logos/test-account.svg",
    mime: "image/xml+svg",
    size: 4000
};
const testAccountOverrides = {
    bgDark: "black",
    bgMedium: "gray",
    customTagsStyles: [],
    fgDark: "yellow",
    headerBgColor: "black",
    systemFont: "Open Sans",
    userFont: "Comic Sans",
    titleFont: "Times New Roman"
};

describe("domain branding", () => {
    it("should save and retrieve branding", async () => {
        const client = await getClient();
        await client.setBrandingForReaderDomain(testDomain, {
            logo: testAccountLogo,
            stylusOverrideProps: testAccountOverrides
        })
        const branding = await client.getBrandingForReaderDomain(testDomain)
        expect(branding.logo).toEqual(testAccountLogo);
        expect(branding.stylusOverrideProps).toEqual(testAccountOverrides);
    });

    it("should return the default correctly", async () => {
        const client = await getClient();
        const branding = await client.getBrandingForReaderDomain("fakedomain.test.me");
        expect(branding.logo).toBeUndefined();
        expect(branding.stylusOverrideProps).toEqual({});
    });
});
