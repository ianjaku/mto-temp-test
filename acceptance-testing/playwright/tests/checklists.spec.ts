import { FEATURE_CHECKLISTS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Checklists", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_CHECKLISTS],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Test collection",
            roles: { Editor: [login] },
        }
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.leftNavigation.createNewDocument();
    await editor.composer.fillTitle("Checklist example");
    await editor.composer.fillNewChunk("intro");
    await editor.composer.fillNewChunk("checkable\nmultiline\nchunk step 1");
    await editor.composer.fillNewChunk("checkable\nmultiline\nchunk step 2");
    await editor.composer.fillNewChunk("outro");
    await editor.composer.toggleChunkCheckable(2);
    await editor.composer.toggleChunkCheckable(3);
    await editor.composer.publish(true);

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReaderAsUser(login, password);
    await reader.browser.openStoryByTitle("Checklist example");

    await reader.document.assertNoCheckboxInCurrentChunk();
    await reader.document.goToNextChunk();

    await reader.document.assertNoCheckboxInCurrentChunk();
    await reader.document.goToNextChunk();

    await reader.document.assertCheckboxInCurrentChunk();
    await reader.document.assertCurrentChunkCheckboxState(false);
    await reader.document.toggleChecklistInActiveChunk();
    await reader.document.goToNextChunk();

    await reader.document.assertCheckboxInCurrentChunk();
    await reader.document.assertCurrentChunkCheckboxState(false);
    await reader.document.goToNextChunk();

    await reader.document.assertNoCheckboxInCurrentChunk();

    await reader.browser.goToHome();
    await reader.browser.expectItemProgressBarValue("Checklist example", 50)

    await editor.leftNavigation.clickMyLibrary();
    await editor.browse.clickItem("Test collection");
    await editor.browse.expectItemProgressBarValue("Checklist example", 50)

});
