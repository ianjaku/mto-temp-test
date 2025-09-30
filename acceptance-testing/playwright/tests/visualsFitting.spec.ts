import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";
import { waitForPlayingVideos } from "../helpers/visuals";

pwTest("Visuals fitting", async ({ createWindow, seed, fixtures }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const documentTitle = "Visuals fitting test";
    await seed({
        users: [
            { login, password }
        ],
        items: {
            title: documentTitle,
            type: "document",
            published: true,
            roles: {
                Editor: [login],
            },
            languageCode: "en",
            chunks: [
                "First chunk",
                "Second chunk",
                "Third chunk",
                "Fourth chunk"
            ],
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem(documentTitle);

    await editor.composer.uploadFileToChunk(1, realpathSync("files/media/landscape.mp4"), 1);
    await editor.composer.uploadFileToChunk(2, realpathSync("files/media/landscape2.mp4"), 2);
    await editor.composer.uploadFileToChunk(3, realpathSync("files/media/portrait.jpg"), 3);
    await editor.composer.uploadFileToChunk(4, realpathSync("files/media/landscape.jpg"), 4);

    await editor.composer.openSettingsForChunkVisual(1);
    await editor.composer.visualSettings.setBackgroundColor("951fbb");
    await editor.composer.visualSettings.setMediaBehaviourToTransformed(); // sets it to "fit"
    await editor.composer.visualSettings.close();

    await editor.composer.openSettingsForChunkVisual(3);
    await editor.composer.visualSettings.setBackgroundColor("951fbb");
    await editor.composer.visualSettings.setMediaBehaviourToTransformed(); // sets it to "fit"
    await editor.composer.visualSettings.close();

    const binderId = await editor.composer.getBinderId();
    const saveOptions = {
        id: binderId,
        visualProperties: {
            0: {
                bgColor: "951fbb",
                fitBehaviour: "fit"
            },
            2: {
                bgColor: "951fbb",
                fitBehaviour: "fit"
            }
        }
    }
    await fixtures.items.waitForBinderToBeSaved(saveOptions);
    await editor.composer.publish(true);
    await editorWindow.getPage().close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle(documentTitle);

    await waitForPlayingVideos(reader, 1, [-1]);
    await waitForPlayingVideos(reader, 2, [-1]);
    await reader.document.goToTop();

    await expect(readerWindow.getPage()).toHaveScreenshot("screen1.png", { maxDiffPixelRatio: 0.02 });
    await reader.document.goToNextChunk();
    await expect(readerWindow.getPage()).toHaveScreenshot("screen2.png", { maxDiffPixelRatio: 0.02 });
    await reader.document.goToNextChunk();
    await expect(readerWindow.getPage()).toHaveScreenshot("screen3.png", { maxDiffPixelRatio: 0.02 });
    await reader.document.goToNextChunk();
    await expect(readerWindow.getPage()).toHaveScreenshot("screen4.png", { maxDiffPixelRatio: 0.02 });
});
