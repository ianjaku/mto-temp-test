import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

const USER_EMAIL = "e2e+123@manual.to";
const USER_DISPLAYNAME = "E2E Test User";
const USER_PASSWORD = "wiernslx2390{}]]'";

/**
 * Note: This test is painful to debug. There are also a couple of requirements around the e2e+123@manual.to email address
 * - is whitelisted in mailgun
 * - the email must not bounce
 * - the user that already exists with that address needs to be cleaned up
 */
pwTest("User sign up", async ({ createWindow, seed, fixtures }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [
            { login, password, isAdmin: true }
        ],
        items: {
            title: "Some collection",
            type: "collection",
        }
    });

    try {
        await fixtures.users.anonymizeUser(USER_EMAIL);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
    }

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditorAsUser(login, password);

    await editor.leftNavigation.clickUsers();
    await editor.users.setNewApprovedEmailPattern("*");
    await editorWindow.close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/signup", fixtures.getDomain());
    await reader.signUp.fillInForm(USER_EMAIL);

    const user = await fixtures.users.getUserByLogin(USER_EMAIL);
    const userToken = await fixtures.users.getUserToken(user.id);
    await readerWindow.gotoReaderLink(`/invite/${userToken.token}`);
    await reader.registerPage.fillInForm(USER_DISPLAYNAME, USER_PASSWORD);

    await reader.errors.expectEmptyAccount();
});
