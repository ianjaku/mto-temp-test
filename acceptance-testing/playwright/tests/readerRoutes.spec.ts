import { it, pwTest } from "../pwTest";
import { DocumentType } from "@binders/client/lib/clients/model";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

const DOC_TITLE = "Example document";
const DOC_SEMANTIC_ID = "testsemanticlink";
const FIRST_CHUNK_CONTENT = "First chunk content"

pwTest("Reader routes", async ({ createTabs, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const { fixtures, itemTree } = await seed({
        features: [FEATURE_PUBLICCONTENT],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    title: DOC_TITLE,
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: [FIRST_CHUNK_CONTENT, "Second chunk"],
                },
            ],
            roles: { Admin: [login] },
        },
    });

    const collectionId = itemTree.items.at(0).id;
    const binderId = itemTree.items.at(1).id;
    await fixtures.routing.setSemanticLink(
        {
            binderId,
            languageCode: "en",
            documentType: DocumentType.DOCUMENT,
            semanticId: DOC_SEMANTIC_ID,
            domain: fixtures.getDomain(),
        },
        binderId,
    );
    const publication = await fixtures.items.getPublicationForBinder(binderId, "en");

    const [tab1, tab2, tab3, tab4, tab5] = await createTabs(5);
    const readerMain = await tab1.openReader("/login");
    await readerMain.login.loginWithEmailAndPass(login, password);
    await readerMain.cookieBanner.declineCookies();


    await it("opens a browse collection route", async () => {
        const reader2 = await tab2.openReader(`/browse/${collectionId}`);
        await reader2.browser.expectStoryByTitle(DOC_TITLE);
    });

    await it("opens a launch route with collection ID", async () => {
        const reader3 = await tab3.openReader(`/launch/${collectionId}/${binderId}`);
        await reader3.document.assertChunkContent(1, FIRST_CHUNK_CONTENT);
    });

    await it("opens a launch route without collection ID", async () => {
        const reader4 = await tab4.openReader(`/launch/${binderId}`);
        await reader4.document.assertChunkContent(1, FIRST_CHUNK_CONTENT);
    });

    await it("opens a preview route with collection ID", async () => {
        const reader5 = await tab5.openReader(`/preview/${collectionId}/${binderId}`);
        await reader5.document.assertChunkContent(1, FIRST_CHUNK_CONTENT);
    });

    await it("opens a preview route without collection ID", async () => {
        const reader1 = await tab1.openReader(`/preview/${binderId}`);
        await reader1.document.assertChunkContent(1, FIRST_CHUNK_CONTENT)
    });

    await it("opens a read route with collection ID", async () => {
        const reader2 = await tab2.openReader(`/read/${collectionId}/${publication.id}`);
        await reader2.document.assertChunkContent(1, FIRST_CHUNK_CONTENT)
    });

    await it("opens a read route without collection ID", async () => {
        const reader3 = await tab3.openReader(`/read/${publication.id}`);
        await reader3.document.assertChunkContent(1, FIRST_CHUNK_CONTENT)
    });

    await it("navigates to root collection from read route", async () => {
        const reader4 = await tab4.openReader(`/read/${publication.id}`);
        await reader4.document.clickUpButton();
        await reader4.browser.expectStoryByTitle(DOC_TITLE);
    });

    await it("opens a semantic link", async () => {
        const reader5 = await tab5.openReader(`/${DOC_SEMANTIC_ID}`);
        await reader5.document.assertChunkContent(1, FIRST_CHUNK_CONTENT)
    });

});