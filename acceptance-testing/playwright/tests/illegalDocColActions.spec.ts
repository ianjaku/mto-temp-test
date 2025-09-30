import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { isBinderItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { pwTest } from "../pwTest";

pwTest("Illegal document and collection actions", async ({ createWindow, seed, fixtures }) => {

    const collectionTitle = "illegal col actions test collection";
    const documentTitle = "illegal doc actions test document";

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const { itemTree } = await seed({
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
                            published: true,
                            languageCode: "en",
                            chunks: [],
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

    await editor.breadcrumbs.openContextMenu();
    await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
    await editor.contextMenu.closeContextMenu();

    await editor.browse.clickItemContextMenu(documentTitle);
    await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);

    const documentId = itemTree.items
        .filter(item => isBinderItem(item))
        .find(item => (<Binder>item).languages[0].storyTitle === documentTitle).id;

    await fixtures.items.unublishDoc(documentId, ["en"]);
    await editorWindow.page.reload();

    await editor.breadcrumbs.openContextMenu();
    await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
    await editor.contextMenu.closeContextMenu();

    await editor.browse.deleteItem(documentTitle);
    await editor.breadcrumbs.deleteCurrentItem();
    await editor.browse.assertInEmptyCollection();

});
