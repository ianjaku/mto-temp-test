import { it, pwTest } from "../pwTest";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Editor change title", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Test collection",
            roles: {
                Editor: [login]
            }
        },
    });

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Test collection");
    await editor.browse.startCreateNewCollection();
    await editor.newCollectionModal.fillName("COLLECTION1");
    await editor.newCollectionModal.clickOk();
    await editor.modals.waitForModalToClose();

    await it("Editing a collection's title is properly saved", async () => {
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Edit");
        await editor.collectionEditModal.fillNameOnIndex(0, "COLLECTION1-edited");
        await editor.collectionEditModal.clickDone();
        await editor.breadcrumbs.assertTitle("COLLECTION1-edited");
    });

    await editor.leftNavigation.clickMyLibrary();
    await editor.browse.startCreateNewDocument();
    await editor.newDocumentModal.clickOk();
    await editor.modals.waitForModalToClose();

    await it("Editing a document's title is properly saved", async () => {
        await editor.composer.fillTitle("DOCUMENT1");
        await editor.breadcrumbs.assertTitle("DOCUMENT1");
        await editor.composer.fillTitle("DOCUMENT1-edited");
        await editor.breadcrumbs.assertTitle("DOCUMENT1-edited");
    });
});
