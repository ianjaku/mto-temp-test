import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

const DOC_TO_DELETE = "delete this document";
const DOC_TO_DELETE_AND_RESTORE = "delete and restore this document";
const COL_TO_DELETE = "delete this collection";


pwTest("Recycle bin/trash basics", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    await seed({
        features: [],
        users: [
            { login, password: "nothanks" }
        ],
        items: {
            title: "col",
            type: "collection",
            roles: {
                Admin: [login],
            },
            children: [
                {
                    title: DOC_TO_DELETE,
                    type: "document",
                },
                {
                    title: DOC_TO_DELETE_AND_RESTORE,
                    type: "document",
                },
                {
                    title: COL_TO_DELETE,
                    type: "collection",
                }
            ]
        }
    });

    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(login, "nothanks");

    await editor.cookieBanner.acceptCookies();
    await editor.browse.clickItem("col");


    await editor.browse.deleteItem(DOC_TO_DELETE);
    await editor.browse.deleteItem(DOC_TO_DELETE_AND_RESTORE);
    await editor.browse.deleteItem(COL_TO_DELETE);

    await editor.leftNavigation.clickRecycleBin();
    await editor.recycleBin.assertItem(DOC_TO_DELETE);
    await editor.recycleBin.assertItem(COL_TO_DELETE);
    await editor.browse.clickItemContextMenu(DOC_TO_DELETE_AND_RESTORE); // we recycle the browse EditorSection because it also contains items with a context menu
    await editor.browse.clickItemInContextMenu("Restore");
    await editor.shared.clickButtonInModal("Proceed", { modalHasText: "Restore item to" });
    await editor.shared.clickButtonInModal("Proceed", { modalHasText: "Are you sure" });

    await editor.browse.clickItemContextMenu(DOC_TO_DELETE);
    await editor.browse.clickItemInContextMenu("Delete");
    await editor.shared.clickButtonInModal("Yes");
    await editor.recycleBin.assertItemNotVisible(DOC_TO_DELETE);

    await editor.leftNavigation.clickMyLibrary();
    await editor.browse.clickItem("col");
    await editor.browse.assertLoadedItem(DOC_TO_DELETE_AND_RESTORE);


});
