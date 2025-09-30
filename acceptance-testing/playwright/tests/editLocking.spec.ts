import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import labels from "@binders/client/lib/i18n/translations/en_US";
import { pwTest } from "../pwTest";

pwTest("Edit locking", async ({ createWindow, createTabs, seed }) => {

    const login1 = createUniqueTestLogin();
    const login2 = createUniqueTestLogin();
    const password =  createUniqueTestLogin();
    const COL_TITLE = "Collection";
    const DOC_TITLE = "Document";
    await seed({
        users: [
            { login: login1, password: password },
            { login: login2, password: password }
        ],
        items: {
            title: COL_TITLE,
            type: "collection",
            roles: {
                Admin: [login1, login2],
            },
            children: [
                {
                    title: DOC_TITLE,
                    type: "document",
                    chunks: [
                        "First chunk"
                    ]
                }
            ]
        }
    });

    const [editorWindow1, editorWindow3] = await createTabs(2);
    const editorWindow2 = await createWindow();

    const editor1 = await editorWindow1.openEditor();
    const editor2 = await editorWindow2.openEditor();

    await editor1.login.loginWithEmailAndPass(login1, password);
    await editor2.login.loginWithEmailAndPass(login2, password);

    await editor1.browse.clickItem(COL_TITLE);
    await editor2.browse.clickItem(COL_TITLE);

    // editor 1 locks document, then unlocks
    await editor1.browse.clickItem(DOC_TITLE);
    await editor2.browse.waitForLockedItem(DOC_TITLE);
    await editor1.breadcrumbs.clickBreadcrumb(COL_TITLE);
    await editor2.browse.waitForUnlockedItem(DOC_TITLE);

    // editor 2 locks document, then unlocks
    await editor2.browse.clickItem(DOC_TITLE);
    await editor1.browse.waitForLockedItem(DOC_TITLE);
    await editor2.breadcrumbs.clickBreadcrumb(COL_TITLE);
    await editor1.browse.waitForUnlockedItem(DOC_TITLE);


    // editor 1 locks, different user goes to document directly
    await editor1.browse.clickItem(DOC_TITLE);
    await editor2.browse.waitForLockedItem(DOC_TITLE);
    const url = await editor1.browse.getCurrentUrl();
    const editor3 = await editorWindow2.openEditor(url);
    await editor3.modals.waitForModalTitle(labels.Edit_LockInfoOtherTitle)
    await editor3.modals.clickOk();
    await editorWindow2.page.close();

    // editor 1 locks, same user goes to document directly and takes over edit session
    const editor4 = await editorWindow3.openEditor(url);
    await editor4.modals.waitForModalTitle(labels.Edit_LockInfoSelfTitle);
    await editor4.modals.clickOk();
    await editor4.modals.waitForModalToClose();
    await editor4.composer.expectChunkValue(0, "First chunk");
    await editor1.browse.assertLoadedItem(DOC_TITLE);
});