import {
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_READER_COMMENTING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Merge chunks comments", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const docTitle = "Merge chunks commenting document";
    await seed({
        features: [FEATURE_COMMENTING_IN_EDITOR, FEATURE_READER_COMMENTING],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: docTitle,
                type: "document",
                published: true,
                languageCode: "en",
                chunks: [
                    "First chunk",
                    "Second chunk",
                ]
            }],
            roles: {
                Editor: [login]
            }
        },
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditorAsUser(login, password);

    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem(docTitle);

    await editor.rightPane.comments.openPane();

    await editor.composer.focusChunk(0);
    await editor.rightPane.comments.clickNewThread();
    await editor.rightPane.comments.addNewComment("Test comment #1");
    await editor.rightPane.comments.assertCommentText(0, 0, "Test comment #1");

    await editor.composer.focusChunk(1);
    await editor.rightPane.comments.clickNewThread();
    await editor.rightPane.comments.addNewComment("Test comment #2");
    await editor.rightPane.comments.assertCommentText(0, 0, "Test comment #2");

    await editor.rightPane.comments.closePane();
    await editor.composer.mergeChunkIntoAbove(1);
    await editor.rightPane.comments.closePane();

    // Add comments on the two chunks on the last publication
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReaderAsUser(login, password);
    await reader.browser.openStoryByTitle(docTitle);
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.writeComment("Test reader comment #1");
    await reader.document.readerComments.submitComment();
    await reader.document.readerComments.expectActiveGroupCommentBody(0, "Test reader comment #1");
    await reader.document.readerComments.closeSidebar();

    await reader.document.goToNextChunk();
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.writeComment("Test reader comment #2");
    await reader.document.readerComments.submitComment();
    await reader.document.readerComments.expectActiveGroupCommentBody(0, "Test reader comment #2");
    await readerWindow.page.close();

    await editorWindow.page.reload();
    await editor.composer.focusChunk(0);
    await editor.rightPane.comments.openPane();

    // Assert all comments are now on the first chunk
    await editor.rightPane.comments.assertCommentText(0, 0, "Test comment #2");
    await editor.rightPane.comments.assertCommentText(1, 0, "Test comment #1");

    await editor.rightPane.comments.switchToCommentsTab("reader");
    await editor.rightPane.comments.assertCommentText(0, 0, "Test reader comment #2");
    await editor.rightPane.comments.assertCommentText(1, 0, "Test reader comment #1");
});
