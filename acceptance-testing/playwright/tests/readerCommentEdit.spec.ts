import { FEATURE_READER_COMMENTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Editing reader comments", async ({ createWindow, seed }) => {

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
            ],
            readerFeedbackConfig: {
                readerCommentsEnabled: true,
            }
        }
    });

    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, password);

    await reader.browser.openStoryByTitle("Reader commenting document");
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.expectSidebarVisible();
    await reader.document.readerComments.writeComment("Test comment on first chunck");
    await reader.document.readerComments.stageAttachment(realpathSync("files/media/portrait.jpg"));
    await reader.document.readerComments.submitComment();
    await reader.document.readerComments.expectCommentBody(0, 0, "Test comment on first chunck");
    await reader.document.readerComments.expectLoadedCommentAttachment(0, 0);
    await reader.document.readerComments.openEditMode(0);
    await reader.document.readerComments.editComment(0, "Test comment on first chunk");
    await reader.document.readerComments.removeAttachment(0, 0);
    await reader.document.readerComments.stageExtraAttachment(0, realpathSync("files/media/landscape.jpg"));
    await reader.document.readerComments.saveEdits(0);
    await reader.document.readerComments.expectEditedLabel(0);
    await reader.document.readerComments.expectCommentBody(0, 0, "Test comment on first chunk");
    await reader.document.readerComments.expectLoadedCommentAttachment(0, 0, { waitForUploadsToFinish: true });
    await expect(window.getPage()).toHaveScreenshot(
        "screen1.png",
        {
            maxDiffPixelRatio: 0.03
        }
    );
});
