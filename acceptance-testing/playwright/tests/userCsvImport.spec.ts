import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

const TEST_USER_LOGIN = `test-${Date.now()}@example.com`;
const CSV_IMPORT_FILE = `first name,last name,email,preferred language
Test,Test,${TEST_USER_LOGIN},en`;

/**
 * Note: current test was added to test the user deletion, but can be further extended
 * into one that verifies assignment to user groups and view permissions (see manual test)
 */
pwTest("User CSV import", async ({ createWindow, seed }) => {
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

    const editorWindow = await createWindow();
    editorWindow.page.setDefaultTimeout(5_000);
    const editor = await editorWindow.openEditorAsUser(login, password);

    await editor.users.switchToUserAdministration();
    await editor.users.csvImportUsers({
        name: "u.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(CSV_IMPORT_FILE, "utf-8"),
    });
    await editor.users.deleteUser(TEST_USER_LOGIN);
});
