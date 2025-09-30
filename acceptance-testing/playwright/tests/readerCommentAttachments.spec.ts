import { FEATURE_READER_COMMENTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import { realpathSync } from "fs";

pwTest("Reader comment attachments", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    await seed({
        features: [FEATURE_READER_COMMENTING],
        users: [
            { login, password: "nothanks" }
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
    await reader.login.loginWithEmailAndPass(login, "nothanks");

    await reader.browser.openStoryByTitle("Reader commenting document");
    await reader.document.readerComments.openSidebar();
    await reader.document.readerComments.expectSidebarVisible();
    await reader.document.readerComments.writeComment("Look at this attachment");
    await reader.document.readerComments.stageAttachment(realpathSync("files/media/portrait.jpg"));
    await reader.document.readerComments.submitComment();

    await reader.document.readerComments.expectLoadedCommentAttachment(0, 0);

});
