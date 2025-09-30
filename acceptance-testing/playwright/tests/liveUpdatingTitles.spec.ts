import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Live updates of item titles in the editor UI after changing them", async ({ createWindow, seed }) => {

    const collectionTitle = "col-update-me";
    const documentTitle = "doc-update-me";

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        users: [
            { login, password }
        ],
        items: {
            title: "root",
            type: "collection",
            roles: {
                Editor: [login],
            },
            children: [
                {
                    title: collectionTitle,
                    type: "collection",
                    children: [
                        {
                            title: documentTitle,
                            type: "document",
                            languageCode: "en",
                        }
                    ]
                },
            ]
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("root");
    await editor.browse.clickItem(collectionTitle);
    await editor.browse.clickItem(documentTitle);

    await editor.composer.fillTitle("doc-was-updated");
    await editor.breadcrumbs.assertTitle("doc-was-updated");
    await editor.breadcrumbs.clickBreadcrumb("root");
    await editor.browse.clickItemContextMenu(collectionTitle);
    await editor.browse.clickItemInContextMenu("Edit");

    await editor.collectionEditModal.fillNameOnIndex(0, "col-was-updated");
    await editor.collectionEditModal.assertModalTitleContains("col-was-updated");
    await editor.collectionEditModal.clickDone();
    await editor.browse.assertLoadedItem("col-was-updated");

});
