import { it, pwTest } from "../pwTest";
import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { realpathSync } from "fs";

pwTest("Editor chunk to chunk translation", async ({ seed, createTabs }, testInfo) => {
    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }

    const editorLogin = createUniqueTestLogin();
    const editorPassword = "nothanks";
    await seed({
        users: [
            { login: editorLogin, password: editorPassword },
        ],
        items: {
            title: "Root collection",
            type: "collection",
            children: [
                {
                    title: "test document",
                    type: "document",
                    chunks: ["Hello"],
                }
            ],
            roles: {
                Editor: [editorLogin]
            }
        }
    });

    const [editorTab, readerTab] = await createTabs(2);
    const editor = await editorTab.openEditorAsUser(editorLogin, editorPassword);

    await it("uploads a visual and published primary language", async () => {
        await editor.browse.clickItem("Root collection");
        await editor.browse.clickItem("test document");
        await editor.rightPane.setPrimaryLanguage("English", false);
        await editor.composer.fillNewChunk("Thanks");
        await editor.composer.waitForAutoSave();
        await editor.composer.uploadFileToChunk(1, realpathSync("files/media/landscape.jpg"), 1);
        await editor.composer.publish(true);
    });

    await it("can add a secondary language and use chunk translation", async () => {
        await editor.rightPane.addLanguage("Dutch");
        await editor.composer.fillSecondaryTitle("test doc nl");
        await editor.composer.translateChunk(0);
        await editor.composer.expectChunkValue(0, "Hallo", { secondary: true, timeoutMs: 1000 * 60 * 3 });
        await editor.composer.waitForAutoSave();
        await editor.composer.publishSecondary(true);
    });

    const reader = await readerTab.openReader();
    await it("validates both languages are available", async () => {
        await reader.browser.openStoryByTitle("test document");
        await reader.document.assertChunkContent(1, "Hello");
        await reader.document.switchLanguage("nl");
        await reader.document.assertChunkContent(1, "Hallo");
        await reader.document.assertVisualWithSrc(1, "cdn.azureedge.net");
    });
});
