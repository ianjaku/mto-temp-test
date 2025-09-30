import {
    createUniqueAccountName,
    createUniqueDomain,
    createUniqueTestLogin,
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TestAccountFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { deleteTestAccounts } from "@binders/binders-service-common/lib/testutils/cleanup";
import { expect } from "@playwright/test";
import { pwTest } from "../pwTest";

const config = BindersConfig.get();

pwTest("Manage Reader Branding", async ({ createWindow, fixtures, seed }) => {
    const plgEmail = createUniqueTestLogin();
    const plgPassword = createUniqueTestLogin();

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    await deleteTestAccounts("Manage Test");

    await seed({
        features: [],
        users: [{ login, password, isRoot: true }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [],
            roles: { Admin: [login] }
        },
    });

    const window = await createWindow();
    const manage = await window.openManage("/login");
    await manage.login.loginWithEmailAndPass(login, password);

    const newAccountName = createUniqueAccountName("test__Manage Test");
    const newAccountDomain = createUniqueDomain();

    await manage.navbar.clickItem("Accounts");
    await manage.accounts.assertDomainNotAssigned(newAccountDomain);

    await manage.accounts.createNew();
    await manage.accounts.fillIn({
        accountName: newAccountName,
        maxNoPublicDocs: "100",
        maxNoLicenses: "100",
    })
    await manage.accounts.clickSubmit();
    await manage.toast.dismiss();

    await manage.navbar.clickItem("Accounts");
    const accountId = await manage.accounts.getAccountId(newAccountName);
    const accountFixtures = new TestAccountFixtures(config, accountId);

    await accountFixtures.routing.setAccountDomain(accountId, newAccountDomain)

    const { items } = await accountFixtures.items.createItemTree({
        type: "collection",
        title: "Root collection",
        children: [
            { type: "document", title: "Welcome", languageCode: "en", chunks: ["Welcome"], published: true },
        ],
        roles: { Admin: [login] }
    })

    const branding = {
        backgroundColor: "#aaaaaa",
        headerBgColor: "#0000ff",
        headerFontColor: "#ffff00",
        primaryColor: "#00ff00",
        styleName: `${newAccountName} style`,
        systemFont: "Poppins",
        userFont: "Raleway",
        textColor: "#ff00ff",
        titleFont: "Oswald",
    };
    await manage.navbar.clickItem("Branding");
    await manage.brandings.editBranding(newAccountDomain);
    await manage.brandings.fillIn(branding);
    await manage.brandings.clickSubmit();
    await manage.toast.dismiss();

    const user = await fixtures.users.create({
        login: plgEmail,
        displayName: "New User",
        password: plgPassword,
    });
    await accountFixtures.accounts.addMember(
        accountId,
        user.id,
        ManageMemberTrigger.INTEGRATION_TEST,
        true,
    );
    await accountFixtures.items.assignRoles(
        items.at(0).id,
        { Editor: [plgEmail] },
    );

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReader("/login", newAccountDomain);
    await reader.login.loginWithEmailAndPass(plgEmail, plgPassword);
    await reader.cookieBanner.declineCookies();
    await reader.browser.openStoryByTitle("Root collection", true)
    await reader.browser.expectStoryByTitle("Welcome", true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bindersBranding = await readerWindow.page.locator("header").evaluate(() => (window as any).bindersBranding.stylusOverrideProps);

    expect(bindersBranding.bgDark).toEqual(branding.primaryColor);
    expect(bindersBranding.bgMedium).toEqual(branding.backgroundColor);
    expect(bindersBranding.fgDark).toEqual(branding.textColor);
    expect(bindersBranding.headerBgColor).toEqual(branding.headerBgColor)
    expect(bindersBranding.headerFontColor).toEqual(branding.headerFontColor)
    expect(bindersBranding.systemFont).toEqual(branding.systemFont);
    expect(bindersBranding.titleFont).toEqual(branding.titleFont);
    expect(bindersBranding.userFont).toEqual(branding.userFont);
});

