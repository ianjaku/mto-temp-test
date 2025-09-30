import { it, pwTest } from "../pwTest";
import { FEATURE_READER_TITLE_CHUNK } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Reader title chunk", async ({ createTabs, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_READER_TITLE_CHUNK],
        users: [
            { login, password },
        ],
        items: {
            type: "collection",
            title: "Test collection",
            roles: {
                Editor: [login]
            },
            children: [
                {
                    type: "document",
                    title: "Document Title",
                    published: true,
                    chunks: ["First chunk"],
                }
            ]
        }
    });

    const [readerTab, editorTab] = await createTabs(2);

    const editor = await editorTab.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await it("disables title mirroring when `reader_title_chunk` feature is on", async () => {
        await editor.browse.clickItem("Test collection");
        await editor.leftNavigation.clickCreate();
        await editor.leftNavigation.clickNewDocument();
        await editor.newDocumentModal.clickOk();
        await editor.modals.waitForModalToClose();
        await editor.composer.fillTitle("Foo Bar");
        await editor.composer.assertFirstChunkIsEmpty();
    });

    await it("shows title chunk in the reader", async () => {
        const reader = await readerTab.openReader("/");
        await reader.browser.openStoryByTitle("Document Title");
        await reader.titleChunk.expectTitle("Document Title");
        await reader.titleChunk.expectReadTime("10 seconds");
        await reader.titleChunk.expectLastUpdatedDate("Last updated less than a minute ago");
        await reader.document.goToNextChunk();
        await reader.document.assertChunkContent(2, "First chunk");
    });
});
