import { PwTestFixtures, pwTest } from "../pwTest";
import { EditorSections } from "../sections/editor/editorsections";
import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { setupSomeAccountAndUser } from "../helpers/seedPresets";

async function testAnonymousEmptyAccount({ createWindow }: Partial<PwTestFixtures>): Promise<void> {
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.waitForLoginButton();
    await readerWindow.getPage().close();
}

async function testLoggedInEmptyAccount({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            roles: { Editor: [login] },
        },
    });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    await reader.errors.expectEmptyAccount();
    await readerWindow.getPage().close();
}

async function testAnonymousNonExistingSemanticLink({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    await setupSomeAccountAndUser({ seed });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/hello-world");
    await reader.errors.expectErrorMessage("The requested content was not found");
    await readerWindow.getPage().close();
}

async function testAnonymousNonExistingPublication({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    await setupSomeAccountAndUser({ seed });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/launch/00000000000000000000/00000000000000000000");
    await reader.errors.expectErrorMessage("The requested content was not found");
    await readerWindow.getPage().close();
}

async function testLoggedInUserNonExistingSemanticLink({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const { login, password } = await setupSomeAccountAndUser({ seed });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    await reader.breadcrumbs.expectBreadcrumbs(["Root collection"]);
    const reader2 = await readerWindow.openReader("/hello-world");
    await reader2.errors.expectErrorMessage("The requested content was not found");
    await readerWindow.getPage().close();
}

async function testLoggedInUserNonExistingPublication({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const { login, password } = await setupSomeAccountAndUser({ seed });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    await reader.breadcrumbs.expectBreadcrumbs(["Root collection"]);
    const reader2 = await readerWindow.openReader("/launch/00000000000000000000/00000000000000000000");
    await reader2.errors.expectErrorMessage("You don't have access to the requested content.");
    await readerWindow.getPage().close();
}

async function testAnonymousEmptyPrivateCollectionSemanticLink({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const { login, password } = await setupSomeAccountAndUserForEmptyCollection({ seed })

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");

    const uniqueSemanticLink = `testlink${Math.floor(Math.random() * 1000000)}`;
    await setCollectionSemanticLink(editor, {
        collectionName: "Test collection",
        semanticLink: uniqueSemanticLink,
        makePublic: false,
    });
    await editorWindow.getPage().close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/" + uniqueSemanticLink);
    await reader.login.waitForLoginButton();
    await readerWindow.getPage().close();
}

async function testAnonymousEmptyPublicCollectionSemanticLink({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const { login, password } = await setupSomeAccountAndUserForEmptyCollection({ seed })

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");

    const uniqueSemanticLink = `testlink${Math.floor(Math.random() * 1000000)}`;
    await setCollectionSemanticLink(editor, {
        collectionName: "Test collection",
        semanticLink: uniqueSemanticLink,
        makePublic: true,
    });
    await editorWindow.getPage().close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/" + uniqueSemanticLink);
    await reader.browser.expectEmptyCollectionMessage();
    await readerWindow.getPage().close();
}

async function testLoggedInUserEmptyPublicCollectionSemanticLink({ createWindow, seed }: Partial<PwTestFixtures>): Promise<void> {
    const { login, password } = await setupSomeAccountAndUserForEmptyCollection({ seed })

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");

    const uniqueSemanticLink = `testlink${Math.floor(Math.random() * 1000000)}`;
    await setCollectionSemanticLink(editor, {
        collectionName: "Test collection",
        semanticLink: uniqueSemanticLink,
        makePublic: true,
    });
    await editorWindow.getPage().close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    const reader2 = await readerWindow.openReader("/" + uniqueSemanticLink);
    await reader2.browser.expectEmptyCollectionMessage();
    await readerWindow.getPage().close();
}

async function setCollectionSemanticLink(editor: EditorSections, options: {
    collectionName: string;
    semanticLink: string;
    makePublic: boolean;
}) {
    if (options.makePublic) {
        await editor.browse.clickItemContextMenu(options.collectionName);
        await editor.browse.clickItemInContextMenu("Access");
        await editor.accessModal.toggleIsPublic();
        await editor.accessModal.clickDone();
    }

    await editor.browse.clickItemContextMenu(options.collectionName);
    await editor.browse.clickItemInContextMenu("Edit");
    await editor.collectionEditModal.switchToTab("Share");
    await editor.collectionEditModal.fillSemanticLinkInput(options.semanticLink);
    await editor.collectionEditModal.clickDone();
}

async function setupSomeAccountAndUserForEmptyCollection({ seed }: Partial<PwTestFixtures>) {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_PUBLICCONTENT],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Test collection",
                type: "collection",
                roles: { Admin: [login] },
                children: [{
                    title: "Test document",
                    type: "document",
                    published: false,
                    roles: { Reader: [login] },
                    languageCode: "en",
                    chunks: ["First chunk", "Second chunk"],
                }],
            }, {
                title: "Test published document",
                type: "document",
                published: true,
                roles: { Admin: [login] },
                languageCode: "en",
                chunks: ["First chunk", "Second chunk"],
            }],
            roles: { Admin: [login] },
        },
    });
    return { login, password };
}

pwTest("Reader access errors", async ({ createWindow, seed }) => {
    /* eslint-disable no-console */
    console.log("testAnonymousEmptyAccount")
    await testAnonymousEmptyAccount({ createWindow, seed });
    console.log("testLoggedInEmptyAccount")
    await testLoggedInEmptyAccount({ createWindow, seed })

    console.log("testAnonymousNonExistingSemanticLink")
    await testAnonymousNonExistingSemanticLink({ createWindow, seed })
    console.log("testAnonymousNonExistingPublication")
    await testAnonymousNonExistingPublication({ createWindow, seed })

    console.log("testLoggedInUserNonExistingSemanticLink")
    await testLoggedInUserNonExistingSemanticLink({ createWindow, seed })
    console.log("testLoggedInUserNonExistingPublication")
    await testLoggedInUserNonExistingPublication({ createWindow, seed })

    console.log("testAnonymousEmptyPublicCollectionSemanticLink")
    await testAnonymousEmptyPublicCollectionSemanticLink({ createWindow, seed })
    console.log("testLoggedInUserEmptyPublicCollectionSemanticLink")
    await testLoggedInUserEmptyPublicCollectionSemanticLink({ createWindow, seed })

    console.log("testAnonymousEmptyPrivateCollectionSemanticLink");
    await testAnonymousEmptyPrivateCollectionSemanticLink({ createWindow, seed });
});
