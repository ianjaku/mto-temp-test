import { it, pwTest } from "../pwTest";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Editor collection deletion", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const ROOT_COLLECTION = "Root collection";
    const COLLECTION_WITH_CHILDREN = "Collection with children";
    const DOCUMENT_WITH_PUBLICATION = "Doc with publication";
    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: ROOT_COLLECTION,
            children: [
                {
                    type: "collection",
                    title: COLLECTION_WITH_CHILDREN,
                    children: [
                        {
                            title: DOCUMENT_WITH_PUBLICATION,
                            type: "document",
                            published: true,
                            languageCode: ["en"],
                            chunks: ["Some content"],
                        }
                    ]
                }
            ],
            roles: { Admin: [login] },
        },
    });

    const editorTab = await createWindow();

    const editor = await editorTab.openEditorAsUser(login, password);
    await editor.browse.clickItem(ROOT_COLLECTION);

    await it("cannot delete collection with active publication", async () => {
        await editor.browse.clickItemContextMenu(COLLECTION_WITH_CHILDREN);
        await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
        await editor.contextMenu.closeContextMenu();
    });

    await editor.browse.clickItem(COLLECTION_WITH_CHILDREN);
    await it("cannot delete document with active publication", async () => {
        await editor.browse.clickItemContextMenu(DOCUMENT_WITH_PUBLICATION);
        await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
        await editor.contextMenu.closeContextMenu();
    });

    await editor.browse.clickItem(DOCUMENT_WITH_PUBLICATION);
    await it("can unpublish document in the editor", async () => {
        await editor.rightPane.publishing.openPane();
        await editor.rightPane.publishing.unpublishPrimaryLanguage();
    });

    await editor.breadcrumbs.clickBreadcrumb(ROOT_COLLECTION);
    await it("cannot delete collection with children", async () => {
        await editor.browse.clickItemContextMenu(COLLECTION_WITH_CHILDREN);
        await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
        await editor.contextMenu.closeContextMenu();
    });

    await editor.browse.clickItem(COLLECTION_WITH_CHILDREN);
    await it("can delete document with no publications", async () => {
        await editor.browse.clickItemContextMenu(DOCUMENT_WITH_PUBLICATION);
        await editor.contextMenu.clickItem("Remove");
        await editor.modals.clickButton("Yes");
        await editor.modals.waitForModalToClose();
        await editor.breadcrumbs.assertTitle(COLLECTION_WITH_CHILDREN);
    });

    await editor.breadcrumbs.clickBreadcrumb(ROOT_COLLECTION);
    await it("can delete collection with no children", async () => {
        await editor.browse.clickItemContextMenu(COLLECTION_WITH_CHILDREN);
        await editor.contextMenu.clickItem("Remove");
        await editor.modals.clickButton("Yes");
        await editor.modals.waitForModalToClose();
        await editor.breadcrumbs.assertTitle(ROOT_COLLECTION);
    })
});