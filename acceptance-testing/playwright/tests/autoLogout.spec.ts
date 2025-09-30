import { EditorSections } from "../sections/editor/editorsections";
import { FEATURE_AUTOLOGOUT } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

async function clickBreadcrumbs(editor: EditorSections, count) {
    for (let i = 0; i < count; i++) {
        await editor.leftNavigation.clickMyLibrary();
        await editor.leftNavigation.wait(1000);
    }
}

pwTest("Autologout - simple case", async ({ createTabs, seed }, testInfo) => {
    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { fixtures } = await seed({
        features: [FEATURE_AUTOLOGOUT],
        users: [
            { login, password }
        ],
        items: {
            type: "collection",
            title: "Some collection",
            roles: {
                Editor: [login]
            },
        }
    });

    const autoLogoutInSeconds = 30;
    const accountId = fixtures.getAccountId();
    await fixtures.accounts.setAccountSecuritySettings(
        accountId,
        { autoLogout: true, autoLogoutPeriodMinutes: autoLogoutInSeconds / 60 }
    )
    const [w1, w2] = await createTabs(2);
    const editor1 = await w1.openEditor();
    await editor1.login.loginWithEmailAndPass(login, password);

    const sessionExtensionDebouceInSeconds = 2;
    const activityCountInFirstTab = 5;
    const startUrl = `/browse?sessionExtensionDebounce=${sessionExtensionDebouceInSeconds * 1000}`;

    await w1.openEditor(startUrl);
    // In tab 1 click the breadcrumbs for (sessionExtensionDebouce * activityCountInFirstTab) seconds
    // This runs async
    clickBreadcrumbs(editor1, activityCountInFirstTab);

    const editor2 = await w2.openEditor(startUrl);
    // Generate activiy in the second tab (runs async)
    // The time taken should be longer than the time it takes for the first tab to auto-logout
    // when there wouldn't be a second tab
    clickBreadcrumbs(
        editor2,
        autoLogoutInSeconds + activityCountInFirstTab + 2 * sessionExtensionDebouceInSeconds
    );

    const logoutTimeout = autoLogoutInSeconds * 3 * 1000;
    await editor1.login.expectErrorMessage("Please log back in.", logoutTimeout);
    await editor2.login.expectErrorMessage("Please log back in.", logoutTimeout);
});
