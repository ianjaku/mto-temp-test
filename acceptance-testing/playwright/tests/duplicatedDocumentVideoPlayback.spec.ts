import { createUniqueTestLogin } from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";
import { waitForPlayingVideos } from "../helpers/visuals";

pwTest("Duplicated document plays video", async ({ createWindow, seed }) => {
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
            children: [
                {
                    type: "document",
                    title: "Duplication document",
                    published: true,
                    chunks: ["first chunk"],
                }
            ]
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Test collection");
    await editor.browse.clickItem("Duplication document");

    const fullPathVideo1 = realpathSync("files/media/landscape.mp4");
    await editor.composer.uploadFileToChunk(1, fullPathVideo1, 1, true);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    await reader.browser.openStoryByTitle("Duplication document");

    await waitForPlayingVideos(reader, 1, [-1]);

    await editorWindow.page.goBack();
    await editor.browse.clickItemContextMenu("Duplication document");
    await editor.browse.clickItemInContextMenu("Duplicate");
    await editor.translocationModal.clickOk();

    await editor.browse.clickUnpublishedItem("Duplication document");
    await editor.composer.fillTitle("Duplicated document");
    await editor.composer.publish(true);

    await reader.document.goToTop();
    await reader.document.clickUpButton();
    await reader.browser.openStoryByTitle("Duplicated document");

    await waitForPlayingVideos(reader, 1, [-1]);
});
