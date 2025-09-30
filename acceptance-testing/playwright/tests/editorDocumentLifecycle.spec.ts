import { it, pwTest } from "../pwTest";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Editor document lifecycle", async ({ createTabs, seed }, testInfo) => {

    if (testInfo.project.name === "firefox") {
        // composer.fillNewChunk is not working as expected on firefox
        // it leaves the chunk empty since the upgrade of playwright to 1.53.1
        return;
    }
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    title: "Doc",
                    type: "document",
                    published: true,
                    languageCode: ["en"],
                    chunks: ["Some content"],
                },
            ],
            roles: { Admin: [login] },
        },
    });

    const [editorTab, readerTab] = await createTabs(2);

    const editor = await editorTab.openEditorAsUser(login, password);
    await it("document preview is functional", async() => {
        await editor.browse.clickItem("Root collection");
        await editor.browse.clickItem("Doc");
        // Added this assertion to make sure the document is properly loaded
        // Without it `fillNewChunk` was sometimes overwriting the first chunk
        await editor.composer.assertChunkContainsRegex(0, /.*Some content.*/);
        // Adding a second wait to prevent the cursor jumping to the first chunk when the document activates
        await editor.composer.wait(500);
        const modification = "An unpublished modification";
        await editor.composer.fillNewChunk(modification);
        await editor.composer.assertChunkContainsRegex(1, new RegExp(`.*${modification}.*`));
        const readerDocument = await editor.composer.openPreview();
        await readerDocument.waitForChunksCount(2);
        await readerDocument.assertChunkContent(2, modification);
    });

    const reader = await readerTab.openReaderAsUser(login, password);
    await it("publication is accessible in the reader", async () => {
        await reader.browser.openStoryByTitle("Doc");
        await reader.document.waitForChunksCount(1);
    });

    await it("cannot delete the document from inside the composer when published", async () => {
        await editor.breadcrumbs.openContextMenu();
        await editor.contextMenu.assertContextMenuItemDisabledState("Remove", true);
        await editor.contextMenu.closeContextMenu();
    });

    await it("can unpublish document in the editor", async () => {
        await editor.rightPane.publishing.openPane();
        await editor.rightPane.publishing.unpublishPrimaryLanguage();
    });

    await it("document is no longer accessible", async () => {
        await readerTab.page.reload();
        await reader.errors.expectErrorMessage("The requested content was not found");
    });

    await it("can delete the document from inside the composer", async () => {
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Remove");
        await editor.modals.clickButton("Yes");
        await editor.modals.waitForModalToClose();
        await editor.breadcrumbs.assertTitle("Root collection");
    });
});