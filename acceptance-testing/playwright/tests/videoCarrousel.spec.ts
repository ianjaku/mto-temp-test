import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";
import { waitForPlayingVideos } from "../helpers/visuals";

pwTest("Video Carrousel", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        features: [],
        users: [
            { login, password }
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
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    const documentTitle = "Video carrousel";
    const fullPathVideo1 = realpathSync("files/media/landscape.mp4");
    const fullPathVideo2 = realpathSync("files/media/landscape2.mp4");
    const fullPathVideo3 = realpathSync("files/media/Movie sample.mov");
    const fullPathImage1 = realpathSync("files/media/portrait.jpg");
    const fullPathImage2 = realpathSync("files/media/landscape.jpg");

    await editor.leftNavigation.createNewDocument();
    await editor.composer.fillTitle(documentTitle);
    await editor.composer.uploadFileToChunk(1, fullPathImage1, 1);
    await editor.composer.uploadFileToChunk(1, fullPathVideo1, 2);
    await editor.composer.uploadFileToChunk(2, fullPathVideo2, 3);
    await editor.composer.uploadFileToChunk(2, fullPathImage2, 4);
    await editor.composer.uploadFileToChunk(3, fullPathVideo1, 5);
    await editor.composer.uploadFileToChunk(3, fullPathVideo3, 6);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle(documentTitle);
    await waitForPlayingVideos(reader, 1, [2]);

    await reader.document.goToTop();
    await reader.document.clickUpButton();
    await reader.browser.openStoryByTitle(documentTitle);
    await waitForPlayingVideos(reader, 2, [1]);

    await reader.document.goToTop();
    await reader.document.clickUpButton();
    await reader.browser.openStoryByTitle(documentTitle);
    await waitForPlayingVideos(reader, 3, [1, 2]);
});
