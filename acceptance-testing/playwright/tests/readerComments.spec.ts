import { FEATURE_READER_COMMENTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";


pwTest("Reader comments", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_READER_COMMENTING],
        users: [
            { login, password }
        ],
        items: {
            title: "Reader commenting document",
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                "First chunk",
                "Second chunk",
                "Third chunk",
                "Fourth chunk"
            ]
        }
    });

    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle("Reader commenting document");
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.expectSidebarVisible();
    await reader.document.readerComments.writeComment("Test comment on first chunk");
    await reader.document.readerComments.submitComment();
    await reader.document.readerComments.expectActiveGroupCommentBody(0, "Test comment on first chunk");
    await reader.document.readerComments.expectWriteCommentTextareaValue("");

    await reader.document.readerComments.closeSidebar();
    await reader.document.goToNextChunk();
    await reader.document.goToNextChunk();
    await reader.document.expandToolbar();
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.writeComment("Test comment on third chunk");
    await reader.document.readerComments.submitComment();
    await reader.document.readerComments.expectActiveGroupCommentBody(0, "Test comment on third chunk");

    await reader.document.expectChunkToBeVisible(2);
    await reader.document.readerComments.selectCommentByContent("Test comment on first chunk");
    await reader.document.expectChunkToBeVisible(0);
    await reader.document.readerComments.selectCommentByContent("Test comment on third chunk");
    await reader.document.expectChunkToBeVisible(2);

    await reader.document.readerComments.deleteChunkComment("Test comment on first chunk");
    await reader.document.readerComments.waitForCommentToBeRemoved("Test comment on first chunk", 2000);
});
