import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";



pwTest("Replace a visual", async ({ createTabs, seed, fixtures }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const COL_TITLE = "Collection";
    const DOC_TITLE = "Document";
    await seed({
        users: [
            { login, password: password }
        ],
        items: {
            title: COL_TITLE,
            type: "collection",
            roles: {
                Admin: [login],
            },
            children: [
                {
                    title: DOC_TITLE,
                    type: "document",
                    chunks: [
                        "First chunk"
                    ]
                }
            ]
        }
    });

    const [readerWindow, editorwWindow] = await createTabs(2);
    const editor = await editorwWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem(COL_TITLE);
    await editor.browse.clickItem(DOC_TITLE);
    await editor.composer.uploadFileToChunk(1, realpathSync("files/media/portrait.jpg"), 1);
    const binderId = await editor.composer.getBinderId();
    await fixtures.items.waitForBinderToBeSaved({
        id: binderId,
        visualCounts: {
            0: 1
        }
    });
    await editor.composer.publish(true);

    const reader = await readerWindow.openReader();
    await reader.browser.openStoryByTitle(DOC_TITLE);
    await reader.document.waitForChunksCount(1);
    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen1.png",
        {
            maxDiffPixelRatio: 0.02
        }
    );

    await editor.composer.openMediaPane();
    await editor.composer.mediaPane.clickThumbnail(0);
    await editor.rightPane.replaceVisual(realpathSync("files/media/landscape.jpg"));
    await editor.rightPane.closeMediaPane();
    await editor.composer.publish(true);

    const reader2 = await readerWindow.openReader();
    await reader2.browser.openStoryByTitle(DOC_TITLE);
    await reader.document.waitForChunksCount(1);
    await expect(readerWindow.getPage()).toHaveScreenshot(
        "screen2.png",
        {
            maxDiffPixelRatio: 0.02
        }
    );

});
