import { FEATURE_VIDEO_STREAMING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Video preloading", async ({ createWindow, seed, fixtures }, testInfo ) => {

    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }
    const login = createUniqueTestLogin();
    await seed({
        features: [FEATURE_VIDEO_STREAMING],
        users: [
            { login, password: "nothanks" },
        ],
        items: {
            type: "collection",
            title: "Test collection",
            roles: {
                Editor: [login]
            },
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, "nothanks");
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Test collection");

    await editor.leftNavigation.createNewDocument();
    await editor.composer.fillTitle("Preloading test doc");

    await editor.composer.fillNewChunk("Second chunk");
    await editor.composer.fillNewChunk("Third chunk - with vid");
    await editor.composer.fillNewChunk("Fourth chunk - with vid");

    const fullPathVideo1 = realpathSync("files/media/landscape.mp4");
    const fullPathVideo2 = realpathSync("files/media/landscape2.mp4");

    await editor.composer.uploadFileToChunk(3, fullPathVideo1, 1);
    const visualIds = await editor.composer.uploadFileToChunk(4, fullPathVideo2, 2, true);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, "nothanks");

    await reader.browser.openStoryByTitle("Preloading test doc");

    await reader.document.assertVisualNotMounted(3, 1);

    await reader.document.goToNextChunk();
    await reader.document.waitForVideoPreloaded(visualIds[0]);

    await reader.document.goToNextChunk();
    await reader.document.waitForVideoPreloaded(visualIds[1]);

    await fixtures.disableFeatures([FEATURE_VIDEO_STREAMING]);

    await readerWindow.page.reload();

    await reader.document.assertVisualNotMounted(3, 1);

    await reader.document.goToNextChunk();
    await reader.document.waitForVideoPreloaded(visualIds[0]);

    await reader.document.goToNextChunk();
    await reader.document.waitForVideoPreloaded(visualIds[1]);

});
