import { FEATURE_NOTIFICATIONS } from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Notification settings", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    await seed({
        features: [FEATURE_NOTIFICATIONS],
        users: [
            { login, password: "nothanks" },
            { displayName: "TestRecipient", firstName: "TestRecipient" }
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
                    title: "Test document",
                    published: false,
                    chunks: ["first chunk"],
                }
            ]
        }
    });

    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(login, "nothanks");
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Test collection");
    await editor.browse.clickItemContextMenu("Test document");
    await editor.browse.clickItemInContextMenu("Notification Settings");

    const notificationSettings = editor.modals.notificationSettings;
    await notificationSettings.openTabByTitle("History");
    await notificationSettings.expectEmptyHistoryPane();

    await notificationSettings.openTabByTitle("Recipients");
    await notificationSettings.addRecipient("New publication", "TestRecipient");
    await notificationSettings.closeModal();

    await editor.browse.clickItem("Test document");
    await editor.composer.publish(true);

    await editor.breadcrumbs.clickBreadcrumb("Test collection");
    await editor.breadcrumbs.openContextMenu();
    await editor.breadcrumbs.clickItemContextMenu("Notification Settings");

    await notificationSettings.openTabByTitle("History");
    await notificationSettings.expectHistoryTableRow(0, "PUBLISH", "TestRecipient");
    await notificationSettings.closeModal();

    await editor.browse.clickItemContextMenu("Test document");
    await editor.browse.clickItemInContextMenu("Notification Settings");

    await notificationSettings.openTabByTitle("Recipients");
    await notificationSettings.removeOnlyRecipient();
    await notificationSettings.addRecipient("Publish request", "TestRecipient");
    await notificationSettings.closeModal();
    await editor.browse.clickItem("Test document");
    await editor.composer.fillChunk(0, "edited text")
    await editor.composer.publish(true);
});
