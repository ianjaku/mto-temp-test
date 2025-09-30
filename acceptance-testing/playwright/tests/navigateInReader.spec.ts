import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Navigate in reader", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [
            { login, password },
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
                    title: "Test document",
                    published: false,
                    chunks: ["first chunk"],
                }
            ]
        }
    });

    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Test collection");
    await editor.browse.startCreateNewCollection();
    await editor.newCollectionModal.fillName("NAVIGATION COLLECTION");
    await editor.newCollectionModal.clickOk();
    await editor.modals.waitForModalToClose();

    for (const documentName of ["DOCUMENT1", "DOCUMENT2", "DOCUMENT3"]) {
        await editor.leftNavigation.clickCreate();
        await editor.leftNavigation.clickNewDocument();
        await editor.newDocumentModal.clickOk();
        await editor.modals.waitForModalToClose();
        await editor.composer.fillTitle(documentName);
        await editor.composer.fillNewChunk(documentName)
        await editor.composer.publish(true);
        await editor.breadcrumbs.clickBreadcrumb("NAVIGATION COLLECTION")
    }

    const reader = await window.openReader("/");
    await reader.browser.openStoryByTitle("NAVIGATION COLLECTION");
    await reader.browser.openStoryByTitle("DOCUMENT1");
    await reader.document.clickNextDocumentButton();
    await reader.document.assertChunkContent(1, "DOCUMENT2")
    await reader.document.clickNextDocumentButton();
    await reader.document.assertChunkContent(1, "DOCUMENT3")
    await reader.document.clickPrevDocumentButton();
    await reader.document.assertChunkContent(1, "DOCUMENT2")
    await reader.document.clickPrevDocumentButton();
    await reader.document.assertChunkContent(1, "DOCUMENT1")
    await reader.document.clickUpButton();
    await reader.browser.expectStoryByTitle("DOCUMENT1")
    await reader.browser.expectStoryByTitle("DOCUMENT2")
    await reader.browser.expectStoryByTitle("DOCUMENT3")
});
