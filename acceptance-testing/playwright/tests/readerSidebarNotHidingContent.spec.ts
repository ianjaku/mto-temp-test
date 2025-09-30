import { FEATURE_READER_COMMENTING } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Reader sidebar not hiding content", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    await seed({
        features: [FEATURE_READER_COMMENTING],
        users: [
            { login, password: "nothanks" },
        ],
        items: {
            title: "testdoc",
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam nec pur. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam nec pur. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam nec pur"
            ]
        }
    });

    const window = await createWindow();
    const reader = await window.openReader("/login");
    await reader.login.loginWithEmailAndPass(login, "nothanks");

    await reader.browser.openStoryByTitle("testdoc");
    await reader.document.waitForChunksCount(1);

    await reader.document.readerComments.openSidebar();

    await window.getPage().setViewportSize({ width: 1600, height: 800 }); // sidebar appearing should trigger narrowing = no overlap
    await reader.document.readerComments.expectSidebarChunkOverlap(0, false);

    await window.getPage().setViewportSize({ width: 1200, height: 800 }); // sidebar appearing should not trigger narrowing = overlap
    await reader.document.readerComments.expectSidebarChunkOverlap(0, true);


});
