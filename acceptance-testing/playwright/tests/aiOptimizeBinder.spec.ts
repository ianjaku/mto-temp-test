import { FEATURE_AI_CONTENT_FORMATTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("AI Optimize Binder", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { fixtures } = await seed({
        features: [FEATURE_AI_CONTENT_FORMATTING],
    });

    const user = await fixtures.users.create({ login, password });

    const chunkTexts = [
        "First chunk [callNo:0]",
        "Second chunk [callNo:0]",
    ]

    const binder = await fixtures.items.createDocument(
        {
            title: "AI content formatting document",
            languageCode: "en",
            chunkTexts
        },
        {
            publish: true,
            addToRoot: true
        }
    );

    const rootCollection = await fixtures.items.getOrCreateRootCollection();
    await fixtures.authorization.assignItemRole(rootCollection.id, user.id, "Editor");
    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editorWindow.overrideLaunchDarklyFlag(LDFlags.AI_CONTENT_OPTIMIZATION, true);
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("AI content formatting document");

    await editor.composer.waitForAutoSave({
        callback: () => editor.composer.optimizeDocument()
    });

    await editor.composer.diffView.expectOriginalChunkValue(0, chunkTexts.at(0))
    await editor.composer.diffView.expectUpdatedChunkValue(0, "This is mocked chunk [callNo:1]")

    await editor.composer.diffView.expectOriginalChunkValue(1, chunkTexts.at(1))
    await editor.composer.diffView.expectUpdatedChunkValue(1, "MockedListCall: [callNo:1]")

    await editor.composer.diffView.retryChunk(0);

    await editor.composer.diffView.acceptUpdatedChunk(0);
    await editor.composer.diffView.expectMergedChunkValue(0, "Optimized", "This is mocked chunk [callNo:1]")

    await editor.composer.diffView.rejectUpdatedChunk(1);
    await editor.composer.diffView.expectMergedChunkValue(1, "Original", chunkTexts.at(1))

    await fixtures.items.waitForBinderToBeSaved({
        id: binder.id,
        chunkContents: {
            "en": [
                "<p>This is <strong>mocked</strong> chunk [callNo:1]</p>",
                `<p>${chunkTexts.at(1)}</p>`,
            ],
        },
    });

    await editor.composer.diffView.retryChunk(0);
    await editor.composer.diffView.expectOriginalChunkValue(0, "This is mocked chunk [callNo:1]")
    await editor.composer.diffView.expectUpdatedChunkValue(0, "This is a mocked response [callNo:2].")
    await editor.composer.diffView.acceptUpdatedChunk(0);
    await editor.composer.diffView.expectMergedChunkValue(0, "Optimized", "This is a mocked response [callNo:2].")

    await fixtures.items.waitForBinderToBeSaved({
        id: binder.id,
        chunkContents: {
            "en": [
                "<p>This is a <strong>mocked</strong> response [callNo:2].</p>",
            ],
        },
        timeout: 20_000
    });

    await editor.composer.diffView.retryChunk(1);
    await editor.composer.diffView.expectOriginalChunkValue(1, chunkTexts.at(1))
    await editor.composer.diffView.expectUpdatedChunkValue(1, "This is a mocked response [callNo:1].")
    await editor.composer.diffView.acceptUpdatedChunk(1);
    await editor.composer.diffView.expectMergedChunkValue(1, "Optimized", "This is a mocked response [callNo:1].")

    await editor.composer.diffView.clickContinueToDocumentButton();

    await editor.composer.expectChunkValue(0, "This is a mocked response [callNo:2].");
    await editor.composer.expectChunkValue(1, "This is a mocked response [callNo:1].");

    await fixtures.items.waitForBinderToBeSaved({
        id: binder.id,
        chunkContents: {
            "en": [
                "<p>This is a <strong>mocked</strong> response [callNo:2].</p>",
                "<p>This is a <strong>mocked</strong> response [callNo:1].</p>",
            ],
        },
        timeout: 20_000
    });
});
