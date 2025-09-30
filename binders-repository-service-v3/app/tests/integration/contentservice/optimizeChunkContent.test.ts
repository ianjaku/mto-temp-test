import { buildContentService, withBinder } from "./utils";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { FEATURE_AI_CONTENT_FORMATTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import type { ILlmService } from "../../../src/contentservice/internal/llm";
import { MockLlmService } from "../../../src/contentservice/mock";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

const config = BindersConfig.get();
const fx = new TestFixtures(config);

xdescribe("optimizeChunkContent", () => {
    it("rejects if the account doesn't have the feature active", async () => {
        const service = await buildContentService(config, new MockLlmService(() => ["Changed title"]));
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                if (!binder?.id) throw new Error("Did not create a Binder");
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeChunkContent({ accountId, binderId, chunkIdx: 0, langIdx: 0, save: true })
                ).rejects.toThrow("The feature is not activated for the account.");
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Foo");
                expect(newBinder.getModules().text?.chunked[0].chunks[0]).toEqual(["<p>Bar</p>"]);
            },
            { title: "Foo", languageCode: "en", chunkTexts: ["Bar"] },
        );
    });

    it("modifies the title chunk", async () => {
        const service = await buildContentService(config, new MockLlmService(() => ["Changed title"]));
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                await fixtures.setFeatures([FEATURE_AI_CONTENT_FORMATTING]);
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeChunkContent({
                        accountId,
                        binderId,
                        chunkIdx: 0,
                        langIdx: 0,
                        save: true,
                    })
                ).resolves.toMatchObject({ markdown: "Changed title" });
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Changed title");
                expect(newBinder.getTextModuleChunksByLanguageAndChunkIndex(0, 0)).toEqual(["<p>Bar</p>"]);
            },
            { title: "Foo", languageCode: "en", chunkTexts: ["Bar"] },
        );
    });

    it("modifies a body chunk", async () => {
        const service = await buildContentService(config, new MockLlmService(() => ["Changed chunk"]));
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                await fixtures.setFeatures([FEATURE_AI_CONTENT_FORMATTING]);
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeChunkContent({ accountId, binderId, chunkIdx: 1, langIdx: 0, save: true })
                ).resolves.toMatchObject({ markdown: "Changed chunk" });
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Foo");
                expect(newBinder.getModules().text?.chunked[0].chunks[0]).toEqual(["<p>Changed chunk</p>"]);
            },
            { title: "Foo", languageCode: "en", chunkTexts: ["Bar"] },
        );
    });

    it("handles errors", async () => {
        class FailingLlm implements ILlmService {
            optimizeContent(): Promise<string[]> {
                throw new Error("Something happened");
            }
        }
        const service = await buildContentService(config, new FailingLlm());
        await withBinder(fx,
            async ({ accountId, binder, fixtures }) => {
                await fixtures.setFeatures([FEATURE_AI_CONTENT_FORMATTING]);
                const binderId = binder.getBinderId();
                await expect(
                    service.optimizeChunkContent({
                        accountId,
                        binderId,
                        chunkIdx: 1,
                        langIdx: 0,
                        save: true,
                    })
                ).rejects.toThrow("Something happened")
                const newBinder = await fixtures.items.getBinderObj(binderId);
                expect(newBinder.getTitle("en")).toEqual("Foo");
                expect(newBinder.getModules().text?.chunked[0].chunks[0]).toEqual(["<p>Bar</p>"]);
            },
            { title: "Foo", languageCode: "en", chunkTexts: ["Bar"] },
        );
    })
});
