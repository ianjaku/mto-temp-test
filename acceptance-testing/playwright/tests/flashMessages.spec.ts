import { PwTestFixtures, pwTest } from "../pwTest";
import { setupSomeAccountAndUser } from "../helpers/seedPresets";
import translation from "@binders/client/lib/i18n/translations/en_US";

type PwTestCase = ({ createWindow, seed }: Partial<PwTestFixtures>) => Promise<void>;

const testEditorInactivityRedirect: PwTestCase = async ({ createTabs, seed }) => {
    const { login, password } = await setupSomeAccountAndUser({ seed });
    const [tab1, tab2] = await createTabs(2);
    const editor1 = await tab1.openEditor();
    await editor1.login.loginWithEmailAndPass(login, password);
    await editor1.cookieBanner.declineCookies();
    const editor2 = await tab2.openEditor("/browse?redirect_reason=composerInactivity")
    await editor2.flashMessage.expectInfoFlashMessage(translation.Redirect_Inactivity);
    await tab1.close();
    await tab2.close();
}

const testReaderBypassChecklistBlockMode: PwTestCase = async ({ createWindow, seed }) => {
    const { login, password } = await setupSomeAccountAndUser({ seed });
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader();
    await reader.login.loginWithEmailAndPass(login, password);
    readerWindow.getPage().context().addCookies([{
        url: reader.readerUrl,
        name: "bypass-checklist-progress",
        value: "1",
    }]);
    await reader.browser.openStoryByTitle("Test document")
    await reader.flashMessage.expectInfoFlashMessage(translation.Reader_ChecklistProgressBypassBlockInfo);
    await readerWindow.getPage().close();
}


pwTest("Reader flash messages", async ({ createTabs, createWindow, seed }) => {
    /* eslint-disable no-console */
    console.log("testEditorInactivityRedirect")
    await testEditorInactivityRedirect({ createTabs, seed });
    console.log("testReaderBypassChecklistBlockMode");
    await testReaderBypassChecklistBlockMode({ createWindow, seed })
});
