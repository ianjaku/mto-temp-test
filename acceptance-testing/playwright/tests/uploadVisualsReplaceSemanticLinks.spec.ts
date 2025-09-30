import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Upload visuals and replace semantic links", async ({ createWindow, createTabs, seed }) => {
    const editorLogin = createUniqueTestLogin();
    await seed({
        users: [
            { login: editorLogin, password: "nothanks" },
        ],
        items: {
            type: "collection",
            title: "Root collection",
            roles: { Editor: [editorLogin] },
            children: [
                {
                    type: "document",
                    title: "My document",
                    languageCode: "en",
                    chunks: ["First chunk"]
                }
            ]
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(editorLogin, "nothanks");
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("My document");
    await editor.composer.uploadFileToChunk(1, realpathSync("files/media/landscape.jpg"), 1);
    await editor.composer.openMediaPane();
    await editor.composer.mediaPane.clickThumbnail(0);
    const [newVisualId] = await editor.rightPane.replaceVisual(realpathSync("files/media/portrait.jpg"));
    await editor.rightPane.closeMediaPane();
    await editor.composer.publish(true);
    await editor.rightPane.share.togglePane();
    const uniqueSemanticLink = `testlink${Math.floor(Math.random() * 1000000)}`;
    await editor.rightPane.share.setSemanticLink(uniqueSemanticLink, "en");

    const [readerTab1, readerTab2, readerTab3] = await createTabs(3);
    const reader1 = await readerTab1.openReader("/");
    await reader1.login.loginWithEmailAndPass(editorLogin, "nothanks");
    await reader1.browser.expectStoryByTitle("My document");
    await readerTab1.close();

    const reader2 = await readerTab2.openReader("/" + uniqueSemanticLink);
    // Waiting for story to appear to make sure the login fully went through.
    await reader2.document.assertChunkContent(1, "First chunk")
    // The url of the image should include the new visual id (instead of the original that was replaced)
    await reader2.document.assertVisualWithSrc(1, newVisualId);
    await readerTab2.close();

    await editor.rightPane.share.addSemanticLink(uniqueSemanticLink + "2", "en");
    const reader3 = await readerTab3.openReader("/" + uniqueSemanticLink + "2");
    await reader3.document.assertChunkContent(1, "First chunk");
    await readerTab3.close();
});
