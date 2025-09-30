import { FEATURE_LIVE_TRANSLATION_ON_READER, FEATURE_READER_COMMENTING, FEATURE_READER_RATING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";


pwTest("Feedback on machine translations", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin(); 
    await seed({
        features: [FEATURE_READER_COMMENTING, FEATURE_READER_RATING, FEATURE_LIVE_TRANSLATION_ON_READER],
        users: [
            { login, password: "nothanks" }
        ],
        items: {
            title: "Feedback document",
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                "First chunk"
            ]
        }
    });

    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, "nothanks");

    await reader.browser.openStoryByTitle("Feedback document");
    await reader.document.readerComments.expectCommentsSidebarButton();
    await reader.document.waitForChunksCount(2);
    await reader.document.goToNextChunk();
    await reader.document.feedback.expectFormVisible();
    await reader.document.goToTop();

    await reader.document.machineTranslateTo("Dutch", "NL");
    await reader.document.readerComments.expectCommentsSidebarButton(false);
    await reader.document.waitForChunksCount(1);

});
