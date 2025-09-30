import { it, pwTest } from "../pwTest";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Public documents visibility and search", async ({ createWindow, createTabs, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_PUBLICCONTENT],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    title: "Unpublished document",
                    type: "document",
                    published: false,
                    languageCode: "en",
                    chunks: ["Hello World"]
                },
                {
                    title: "Private document",
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: ["Hello World"]
                },
                {
                    title: "Public advertised document",
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: ["Hello World"]
                },
                {
                    title: "Public advertised collection",
                    type: "collection",
                    children: [
                        {
                            title: "Public document inside public advertised collection",
                            type: "document",
                            published: true,
                            languageCode: "en",
                            chunks: ["Hello World"]
                        },
                    ]
                },
                {
                    title: "Public not advertised document",
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: ["Hello World"]
                },
            ],
            roles: {
                Admin: [login]
            }
        },
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");

    await editor.browse.clickItemContextMenu("Public advertised document");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.toggleShowOnLandingPage();
    await editor.accessModal.clickDone();

    await editor.browse.clickItemContextMenu("Public advertised collection");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.toggleShowOnLandingPage();
    await editor.accessModal.clickDone();

    await editor.browse.clickItem("Public advertised collection");
    await editor.browse.clickItemContextMenu("Public document inside public advertised collection");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.assertIsPublicCheckedAndDisabled();
    await editor.accessModal.toggleShowOnLandingPage();
    await editor.accessModal.clickDone();

    await editor.breadcrumbs.clickBreadcrumb("Root collection");
    await editor.browse.clickItemContextMenu("Public not advertised document");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.clickDone();

    await editor.browse.clickItem("Public not advertised document");
    await editor.rightPane.share.togglePane();
    const uniqueSemanticLink = `testlink${Math.floor(Math.random() * 1000000)}`;
    await editor.rightPane.share.addSemanticLink(uniqueSemanticLink, "en");

    const [readerTab1, readerTab2, readerTab3, readerTab4] = await createTabs(4);
    await it("Only advertised documents & collections are visible in the reader", async () => {
        const anonymousReader1 = await readerTab1.openReader();
        await anonymousReader1.cookieBanner.declineCookies();
        await anonymousReader1.browser.expectStoryByTitle("Public advertised document", true);
        await anonymousReader1.browser.expectStoryByTitle("Public advertised collection", true);
        await anonymousReader1.browser.expectNoStoryByTitle("Public not advertised document", true);
        await anonymousReader1.browser.openStoryByTitle("Public advertised collection", true);
        await anonymousReader1.browser.expectStoryByTitle("Public document inside public advertised collection", true);
    });

    await it("Public document can be opened by unique semantic link", async () => {
        const anonymousReader2 = await readerTab2.openReader("/" + uniqueSemanticLink);
        await anonymousReader2.document.assertChunkContent(1, "Hello World");
    });

    await it("Anonymous user can search advertised documents only", async () => {
        const anonymousReader3 = await readerTab3.openReader();
        await anonymousReader3.topBar.search("Hello");
        await anonymousReader3.browser.expectStoryByTitle("Public advertised document", true);
        await anonymousReader3.browser.expectStoryByTitle("Public document inside public advertised collection", true);
    });

    await it("Logged in reader can search all documents", async () => {
        const loggedInReader = await readerTab4.openReaderAsUser(login, password);
        await loggedInReader.topBar.search("Hello");
        await loggedInReader.browser.expectStoriesCount(4);
        await loggedInReader.browser.expectStoryByTitle("Public advertised document", true);
        await loggedInReader.browser.expectStoryByTitle("Public document inside public advertised collection", true);
        await loggedInReader.browser.expectStoryByTitle("Public not advertised document", true);
        await loggedInReader.browser.expectStoryByTitle("Private document", true);
    });
});
