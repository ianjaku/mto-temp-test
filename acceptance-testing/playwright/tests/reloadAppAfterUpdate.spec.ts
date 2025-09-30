import {
    createUniqueTestLogin
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import labels from "@binders/client/lib/i18n/translations/en_US";
import { pwTest } from "../pwTest";

pwTest("Reload app when there is an update", async ({ seed, createTabs }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await seed({
        users: [
            { login, password },
        ],
        items: {
            title: "Root collection",
            type: "collection",
            children: [
                {
                    title: "test document",
                    type: "document",
                    chunks: ["Hello"],
                    published: true
                }
            ],
            roles: {
                Editor: [login]
            }
        }
    });

    const urlWithMockForceUpdate = "/browse?mockForceUpdate=10000";
    const [tab1, tab2, tab3, tab4] = await createTabs(4);
    const editor1 = await tab1.openEditor();
    await editor1.login.loginWithEmailAndPass(login, password);
    const editor2 = await tab2.openEditor(urlWithMockForceUpdate);
    await editor2.shared.expectRibbon(labels.General_NewReleaseReloadInfo);
    await editor2.shared.clickButtonInRibbon(labels.General_Reload);
    await editor2.shared.expectNoRibbon(labels.General_NewReleaseReloadInfo);
    const editor3 = await tab3.openEditor(urlWithMockForceUpdate);
    await editor3.shared.expectRibbon(labels.General_NewReleaseReloadInfo);
    for (let i = 0; i < 10; i++) {
        await editor3.leftNavigation.clickMyLibrary();
        await editor3.leftNavigation.wait(1000);
    }
    await editor3.shared.expectRibbon(labels.General_NewReleaseReloadInfo);
    await editor3.shared.expectNoRibbon(labels.General_NewReleaseReloadInfo);
    const reader = await tab4.openReader(urlWithMockForceUpdate);
    await reader.ribbons.expectRibbonWithText(labels.General_NewReleaseReloadInfo);
    await reader.ribbons.expectNoRibbonWithText(labels.General_NewReleaseReloadInfo);
});
