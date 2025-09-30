import { buildContentService, withBinder } from "./utils";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { FEATURE_AI_CONTENT_FORMATTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import { MockLlmService } from "../../../src/contentservice/mock";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const fx = new TestFixtures(config);

jest.mock("@binders/binders-service-common/lib/tracking/createPosthogClient", () => ({
    createPosthogClient: () => null
}));

xdescribe("optimizeBinderContent", () => {
    it("rejects if the account doesn't have the feature active", async () => {
        const service = await buildContentService(config, new MockLlmService(() => [""]));
        await withBinder(fx,
            async ({ accountId, binder }) => {
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeBinderContent({ accountId, binderId, langIdx: 0, save: true })
                ).rejects.toThrow("The feature is not activated for the account.");
            },
            { title: "Foo", languageCode: "en", chunkTexts: ["Bar"] },
        );
    });

    it("handles HTML flavor of the XML", async () => {
        const MOCKED_RESPONSE = `\`\`\`
<manual>
<title>Hello World</title>
<chunks>
<chunk><h1>Hello World</h1></chunk>
<chunk><p>&nbsp;</p></chunk>
<chunk><p><br></p></chunk>
</chunks>
</manual>
\`\`\``;
        const service = await buildContentService(config, new MockLlmService(() => [MOCKED_RESPONSE]));
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                await fixtures.setFeatures([FEATURE_AI_CONTENT_FORMATTING]);
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeBinderContent({ accountId, binderId, langIdx: 0, save: true })
                ).resolves.not.toBeNull();
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Hello World");
                expect(newBinder.getModules().text?.chunked[0].chunks[0]).toEqual(["<h1>Hello World</h1>"]);
                expect(newBinder.getModules().text?.chunked[0].chunks[1]).toEqual(["<p>&nbsp;</p>"]);
                expect(newBinder.getModules().text?.chunked[0].chunks[2]).toEqual(["<p><br></p>"]);
            },
            {
                title: "Hello World",
                languageCode: "en",
                chunkTexts: [
                    "Hello World",
                    " ",
                    "",
                ],
            },
        );
    });

    it("modifies the Binder", async () => {
        const MOCKED_RESPONSE = `\`\`\`
<manual>
<title>Hello World</title>
<chunks>
<chunk><h1>Hello World</h1></chunk>
<chunk><h2>Test</h2>\n<p>Test body</p></chunk>
<chunk><h2>Test</h2>\n<ul>\n<li>Test</li>\n<li>List</li>\n</ul></chunk>
</chunks>
</manual>
\`\`\``;
        const service = await buildContentService(config, new MockLlmService(() => [MOCKED_RESPONSE]));
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                await fixtures.setFeatures([FEATURE_AI_CONTENT_FORMATTING]);
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeBinderContent({ accountId, binderId, langIdx: 0, save: true })
                ).resolves.not.toBeNull();
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Hello World");
                expect(newBinder.getModules().text?.chunked[0].chunks[0]).toEqual(["<h1>Hello World</h1>"]);
                expect(newBinder.getModules().text?.chunked[0].chunks[1]).toEqual(["<h2>Test</h2>\n<p>Test body</p>"]);
                expect(newBinder.getModules().text?.chunked[0].chunks[2]).toEqual(["<h2>Test</h2>\n<ul>\n<li>Test</li>\n<li>List</li>\n</ul>"]);
            },
            {
                title: "Hello World",
                languageCode: "en",
                chunkTexts: [
                    "Hello World",
                    "Test Test body",
                    "Test Test List",
                ],
            },
        );
    });
});
