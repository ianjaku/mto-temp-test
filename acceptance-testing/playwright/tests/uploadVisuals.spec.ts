import { FEATURE_NOCDN } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Upload visuals", async ({ createWindow, seed, fixtures }, testInfo) => {
    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const rootCollectionName = "Test collection";
    const testDocumentTitle = "Test document";
    const chunkContent = "ChunkContent"

    await seed({
        users: [
            { login, password }
        ],
        items: {
            type: "collection",
            title: rootCollectionName,
            roles: {
                Editor: [login]
            },
            children: [
                {
                    type: "document",
                    title: testDocumentTitle,
                    published: true,
                    chunks: [ chunkContent ],
                }
            ]

        }
    });
    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.acceptCookies();
    await editor.browse.clickItem(rootCollectionName);
    await editor.browse.clickItem(testDocumentTitle);

    const newTitle = "Updated title";
    await editor.composer.fillTitle(newTitle);
    await editor.composer.uploadFileToChunk(1, realpathSync("files/media/portrait.jpg"), 1);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle(newTitle);
    await reader.document.assertChunkContent(1, chunkContent);
    await reader.document.assertVisualWithSrc(1, "cdn.azureedge.net");
    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen1.png",
        {
            maxDiffPixelRatio: 0.02
        }
    );

    await fixtures.enableFeatures([FEATURE_NOCDN]);

    await readerWindow.page.reload();
    await reader.document.assertChunkContent(1, chunkContent);
    await reader.document.assertVisualWithSrc(1, "image/v1/binders");
    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen1.png",
        {
            maxDiffPixelRatio: 0.02
        });
})