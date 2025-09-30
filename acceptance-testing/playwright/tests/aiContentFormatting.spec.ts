import { PwTestFixtures, pwTest } from "../pwTest";
import { FEATURE_AI_CONTENT_FORMATTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

async function testAiContentFormatting({
    createWindow,
    seed,
}: Partial<PwTestFixtures>) {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { fixtures } = await seed({
        features: [FEATURE_AI_CONTENT_FORMATTING],
    });

    const user = await fixtures.users.create({ login, password });

    const chunkTexts = [
        "First chunk",
        "Second chunk",
        "Third chunk",
        "Fourth chunk"
    ]
    const chunkHtmls = [
        "<p>First chunk</p>",
        "<p>Second chunk</p>",
        "<p>Third chunk</p>",
        "<p>Fourth chunk</p>"
    ]

    const binder = await fixtures.items.createDocument(
        {
            title: "AI content formatting document",
            languageCode: "en",
            chunkTexts
        },
        { publish: true, addToRoot: true },
    )

    const rootCollection = await fixtures.items.getOrCreateRootCollection();
    await fixtures.authorization.assignItemRole(rootCollection.id, user.id, "Editor");
    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editorWindow.overrideLaunchDarklyFlag(LDFlags.AI_CONTENT_OPTIMIZATION, true);
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("AI content formatting document");

    async function validateChange(callback, chunkIndex, chunkContent, binderContent) {
        await editor.composer.waitForAutoSave({ callback });
        await editor.composer.expectChunkValue(chunkIndex, chunkContent);
        await fixtures.items.waitForBinderToBeSaved({
            id: binder.id,
            chunkContents: { "en": binderContent }
        });
    }

    async function applyAi(chunkIndex) {
        await validateChange(
            () => editor.composer.applyAiFormatting(chunkIndex),
            chunkIndex,
            "This is a mocked response [callNo:1].",
            [
                ...chunkHtmls.slice(0, chunkIndex),
                "<p>This is a <strong>mocked</strong> response [callNo:1].</p>",
                ...chunkHtmls.slice(chunkIndex + 1),
            ],
        )
    }

    async function undoAi(chunkIndex) {
        await validateChange(
            () => editor.composer.undoAiFormatting(chunkIndex),
            chunkIndex,
            chunkTexts[chunkIndex],
            chunkHtmls,
        )
    }

    // Note, this is expecting the content service to be mocked
    // If running the test locally, set the environment variable BINDERS_MOCK_SERVICES to 'aicontent' in devConfig.json
    // ...
    // "environmentVariables": {
    //     ...
    //     "BINDERS_MOCK_SERVICES": "aicontent"
    // }
    // ...

    await applyAi(1);
    await editor.composer.openContextMenu(1);
    await editor.composer.expectChunkContextMenuItem(1, "Undo AI formatting");
    await editor.composer.closeContextMenu();
    await undoAi(1);
    await applyAi(0);
    await undoAi(0);

    await editorWindow.page.close();
}

async function testAiContentFormattingWithoutFeature({
    createWindow,
    seed
}: Partial<PwTestFixtures>): Promise<void> {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "AI content formatting document",
                type: "document",
                published: true,
                languageCode: "en",
                chunks: [
                    "First chunk",
                    "Second chunk",
                ]
            }],
            roles: { Editor: [login] }
        },
    });

    const editorWindow = await createWindow();

    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("AI content formatting document");

    await editor.composer.assertNoContextMenu(1);

    await editorWindow.page.close();
}

pwTest("AI content formatting", async ({ createWindow, seed }) => {
    await testAiContentFormatting({ createWindow, seed });
    await testAiContentFormattingWithoutFeature({ createWindow, seed });
});
