import { FEATURE_PUBLICCONTENT } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";


pwTest("Public+advertised vs public items", async ({ createTabs, createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [
            FEATURE_PUBLICCONTENT,
        ],
        users: [
            { login, password }
        ],
        items: {
            type: "collection",
            title: "Some collection",
            roles: {
                Admin: [login]
            },
        }
    });
    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.leftNavigation.createNewDocument();
    await editor.composer.fillTitle("Public and advertized");
    await editor.composer.publish(true);
    await editor.leftNavigation.clickMyLibrary();

    await editor.leftNavigation.createNewDocument();
    await editor.composer.fillTitle("Public non advertized");
    await editor.composer.publish(true);
    const currentUrl = await window.page.url();
    const publicDocId = [...currentUrl.split("/")].filter(p => !!p).pop();

    await editor.leftNavigation.clickMyLibrary();

    await editor.browse.clickItem("Some collection");
    await editor.browse.clickItemContextMenu("Public and advertized");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.toggleShowOnLandingPage();
    await editor.accessModal.clickDone();

    await editor.browse.clickItemContextMenu("Public non advertized");
    await editor.browse.clickItemInContextMenu("Access");
    await editor.accessModal.toggleIsPublic();
    await editor.accessModal.clickDone();

    const [tab1, tab2] = await createTabs(2);
    const reader = await tab1.openReader();
    await reader.browser.expectStoryByTitle("Public and advertized");
    await reader.browser.expectNoStoryByTitle("Public non advertized");

    const reader2 = await tab2.openReader(`/launch/${publicDocId}`);
    await reader2.document.assertChunkContent(1, "Public non advertized");

});
