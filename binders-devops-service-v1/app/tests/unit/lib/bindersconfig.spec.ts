import { BindersEnvironment, EnvironmentKind, buildBindersConfig } from "../../../src/lib/bindersconfig";
import { mockBinderSecrets, mockBinderSecretsFactory } from "../../testdata/mockBinderSecrets";

function mockBindersEnvironment(kind: EnvironmentKind) {
    return {
        kind,
        mongo: {
            instances: []
        },
        redis: {
            useSentinel: false,
            host: "",
            port: 0
        },
        locations: {},
        externalLocations: {},
        elastic: {
            binders: undefined,
            logevents: undefined,
            useractions: undefined
        },
        rabbit: {
            host: "",
            port: 0
        }
    } satisfies BindersEnvironment;
}

const stagingSecrets = mockBinderSecretsFactory({
    azure: {
        ...mockBinderSecrets.azure,
        blobs: { "videos-v2": { account: "stgazure", accessKey: "accessKey" } },
        cdn: {
            attachment: "manualto-stg-attachments-cdn.azureedge.net",
            audio: "manualto-stg-audio-cdn.azureedge.net",
            images: "manualto-stg-images-cdn.azureedge.net",
            videos: "manualto-stg-videos-cdn.azureedge.net"
        },
    }
});
const prodSecrets = mockBinderSecretsFactory({
    azure: {
        ...mockBinderSecrets.azure,
        blobs: { "videos-v2": { account: "prodazure", accessKey: "accessKey" } },
        cdn: {
            attachment: "manualto-prod-attachments-cdn.azureedge.net",
            audio: "manualto-prod-audio-cdn.azureedge.net",
            images: "manualto-prod-images-cdn.azureedge.net",
            videos: "manualto-prod-videos-cdn.azureedge.net"
        },
    }
});

describe("buildBindersConfig", () => {
    describe("CSP", () => {

        it("adds both staging & production azure endpoints for staging", () => {
            const cfg = buildBindersConfig(
                mockBindersEnvironment("staging"),
                stagingSecrets,
                prodSecrets,
            )
            const csp = cfg.contentSecurityPolicy;
            if (typeof csp === "boolean") throw new Error("CSP should not be false")

            const expectedmImgSrcs = [
                "https://stgazure.blob.core.windows.net",
                "https://prodazure.blob.core.windows.net",
                "https://manualto-stg-videos-cdn.azureedge.net",
                "https://manualto-stg-images-cdn.azureedge.net",
                "https://manualto-prod-videos-cdn.azureedge.net",
                "https://manualto-prod-images-cdn.azureedge.net",
            ]
            for (const imgSrc of expectedmImgSrcs) {
                expect(csp.directives.imgSrc).toContain(imgSrc)
            }

            const expectedMediaSrcs = [
                "https://manualto-stg-videos-cdn.azureedge.net",
                "https://manualto-stg-audio-cdn.azureedge.net",
                "https://manualto-prod-videos-cdn.azureedge.net",
                "https://manualto-prod-audio-cdn.azureedge.net",
                "https://prodazure.blob.core.windows.net",
                "https://stgazure.blob.core.windows.net"
            ]
            for (const mediaSrc of expectedMediaSrcs) {
                expect(csp.directives.mediaSrc).toContain(mediaSrc)
            }
        })

        it("adds only production azure endpoints for production", () => {
            const cfg = buildBindersConfig(
                mockBindersEnvironment("production"),
                prodSecrets,
            )
            const csp = cfg.contentSecurityPolicy;
            if (typeof csp === "boolean") throw new Error("CSP should not be false")

            const expectedmImgSrcs = [
                "https://prodazure.blob.core.windows.net",
                "https://manualto-prod-videos-cdn.azureedge.net",
                "https://manualto-prod-images-cdn.azureedge.net",
            ]
            for (const imgSrc of expectedmImgSrcs) {
                expect(csp.directives.imgSrc).toContain(imgSrc)
            }

            const expectedMediaSrcs = [
                "https://manualto-prod-videos-cdn.azureedge.net",
                "https://manualto-prod-audio-cdn.azureedge.net",
                "https://prodazure.blob.core.windows.net",
            ]
            for (const mediaSrc of expectedMediaSrcs) {
                expect(csp.directives.mediaSrc).toContain(mediaSrc)
            }
        })
    });
});
