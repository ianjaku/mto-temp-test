import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Upload SVG", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    await seed({
        users: [
            { login, password: "nothanks" }
        ],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    type: "document",
                    title: "My document",
                    chunks: ["First chunk"],
                    languageCode: "en"
                }
            ],
            roles: {
                Editor: [login]
            }
        },
    });
    
    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(login, "nothanks");
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("My document");
    await editor.composer.fillNewChunk("Second chunk");
    const [visualId] = await editor.composer.uploadFileToChunk(1, realpathSync("files/media/portrait.svg"), 1);
    await editor.composer.uploadFileToChunk(2, realpathSync("files/media/portrait.svg"), 2);
    await editor.composer.publish(true);

    const reader = await window.openReader("/");
    await reader.browser.openStoryByTitle("My document");
    await reader.document.assertVisualWithSrc(1, visualId);
});
