import { PwTestFixtures, pwTest } from "../pwTest";
import { MailMessage } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";
import labels from "@binders/client/lib/i18n/translations/en_US";

function extractLink(mail: MailMessage, serviceLocation: string) {
    const match = mail.html.match(new RegExp(`href="(${serviceLocation}[A-Za-z0-9.:/?=_-]+)`));
    expect(match).not.toBeNull();
    const link = match[1];
    expect(link.startsWith("http")).toBe(true);
    return link;
}

async function testResetPasswordReader({
    createWindow,
    seed,
    fixtures,
    serviceLocations
}: Partial<PwTestFixtures>): Promise<void> {


    const [login, password, updatedPassword] = [createUniqueTestLogin(), createUniqueTestLogin(), createUniqueTestLogin()];
    const DOCUMENT_TITLE = "Document title";
    await seed({
        users: [
            { login, password }
        ],

        items: {
            title: DOCUMENT_TITLE,
            type: "document",
            published: true,
            roles: {
                Reader: [login],
            },
            languageCode: "en",
            chunks: [
                "An interesting first chunk",
            ]
        }
    })
    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("reset-password");

    const FORM_SUBMITTED_MESSAGE = labels.User_ResetPasswordFeedback;

    await reader.resetPassword.fillEmail("foo");
    await reader.resetPassword.clickSubmit();
    await reader.flashMessage.expectErrorFlashMessage("Invalid email address: foo");

    await readerWindow.page.reload();

    await reader.resetPassword.fillEmail("foo");
    await reader.resetPassword.pressEnter();
    await reader.flashMessage.expectErrorFlashMessage("Invalid email address: foo");

    await readerWindow.page.reload();

    await reader.resetPassword.fillEmail("foo@bar.invalid");
    await reader.resetPassword.clickSubmit();
    await reader.resetPassword.expectSuccessMessage(FORM_SUBMITTED_MESSAGE);

    await readerWindow.page.reload();

    await reader.resetPassword.fillEmail("foo@bar.invalid");
    await reader.resetPassword.pressEnter();
    await reader.resetPassword.expectSuccessMessage(FORM_SUBMITTED_MESSAGE);

    await readerWindow.page.reload();

    await reader.resetPassword.fillEmail(login);
    await reader.resetPassword.pressEnter();
    await reader.resetPassword.expectSuccessMessage(FORM_SUBMITTED_MESSAGE);

    const mails = await fixtures.users.getMockedEmails(login);
    expect(mails.length).toBe(1);
    const mail = mails[0];
    const link = extractLink(mail, serviceLocations.reader);
    await readerWindow.page.goto(link);
    await reader.resetPassword.updatePassword(updatedPassword);

    const readerWindow2 = await createWindow();
    const reader2 = await readerWindow2.openReader();
    await reader2.login.loginWithEmailAndPass(login, updatedPassword);
    await reader2.browser.expectStoryByTitle(DOCUMENT_TITLE);
}

async function testResetPasswordEditor({
    createWindow,
    fixtures,
    seed,
    serviceLocations
}: Partial<PwTestFixtures>) {

    const [login, password, updatedPassword] = [createUniqueTestLogin(), createUniqueTestLogin(), createUniqueTestLogin()];
    const DOCUMENT_TITLE = "Document title";
    await seed({
        users: [
            { login, password }
        ],

        items: {
            title: DOCUMENT_TITLE,
            type: "document",
            published: true,
            roles: {
                Editor: [login],
            },
            languageCode: "en",
            chunks: [
                "An interesting first chunk",
            ]
        }
    })

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor("reset-password");

    const FORM_SUBMITTED_MESSAGE = labels.User_InvitationSentFeedback + "\n";

    await editor.resetPassword.fillEmail("foo");
    await editor.resetPassword.clickSubmit();
    await editor.resetPassword.expectFeedbackMessage(FORM_SUBMITTED_MESSAGE);

    await editorWindow.page.reload();

    await editor.resetPassword.fillEmail("foo");
    await editor.resetPassword.pressEnter();
    await editor.resetPassword.expectFeedbackMessage(FORM_SUBMITTED_MESSAGE);

    await editorWindow.page.reload();

    await editor.resetPassword.fillEmail(login);
    await editor.resetPassword.pressEnter();
    await editor.resetPassword.expectFeedbackMessage(FORM_SUBMITTED_MESSAGE);

    const mails = await fixtures.users.getMockedEmails(login);
    expect(mails.length).toBe(1);
    const mail = mails[0];
    const link = extractLink(mail, serviceLocations.editor);
    await editorWindow.page.goto(link);
    await editor.resetPassword.updatePassword(updatedPassword);
    await editor.browse.assertLoadedItem(DOCUMENT_TITLE);
    const logoutUrl = serviceLocations.editor + "/logout";
    await editorWindow.page.goto(logoutUrl);

    const editor2 = await editorWindow.openEditorAsUser(login, updatedPassword);
    await editor2.browse.assertLoadedItem(DOCUMENT_TITLE);
}

pwTest("Reset password", async ({ createWindow, seed, fixtures, serviceLocations }) => {
    await testResetPasswordEditor({ createWindow, seed, fixtures, serviceLocations })
    await testResetPasswordReader({ createWindow, seed, fixtures, serviceLocations })
});
