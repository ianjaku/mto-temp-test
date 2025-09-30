import {
    createUniqueAccountName,
    createUniqueDomain,
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { TestAccountFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { ensureAccountAndUsers } from "../../config/boilerplate/ensureAccount";
import { pwTest } from "../pwTest";

const config = BindersConfig.get();

pwTest("Editor Account Switch", async ({ createWindow }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const binderDef = {
        type: "document" as const,
        published: true,
        languageCode: "en",
        chunks: [
            "First chunk",
            "Second chunk",
        ]
    };

    const userDef = {
        login,
        password,
        name: login,
        firstName: login,
        lastName: login,
        isAdmin: true,
    };

    const {
        accountId: fooAccountId,
        domain: fooDomain,
        accountName: fooAccountName,
    } = await ensureAccountAndUsers({
        account: {
            name: createUniqueAccountName("Foo"),
            domain: createUniqueDomain(),
            features: [],
            members: [userDef],
            usergroups: [],
            accountId: ""
        },
        user: userDef,
    })

    const {
        accountId: barAccountId,
        accountName: barAccountName,
    } = await ensureAccountAndUsers({
        account: {
            name: createUniqueAccountName("Bar"),
            domain: createUniqueDomain(),
            features: [],
            members: [userDef],
            usergroups: [],
            accountId: ""
        },
        user: userDef,
    })


    const fooFixtures = new TestAccountFixtures(config, fooAccountId);
    const barFixtures = new TestAccountFixtures(config, barAccountId);

    await fooFixtures.items.createDocument(
        { ...binderDef, title: "Foo Document" },
        { publish: true, addToRoot: true },
    );
    await barFixtures.items.createDocument(
        { ...binderDef, title: "Bar Document" },
        { publish: true, addToRoot: true },
    );

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.leftNavigation.switchAccount(fooAccountName);
    await editor.leftNavigation.assertCurrentAccount(fooAccountName)
    await editor.browse.assertLoadedItem("Foo Document");
    await editor.leftNavigation.switchAccount(barAccountName);
    await editor.leftNavigation.assertCurrentAccount(barAccountName)
    await editor.browse.assertLoadedItem("Bar Document");
    await window.page.reload();
    await editor.leftNavigation.assertCurrentAccount(barAccountName)
    await editor.browse.assertLoadedItem("Bar Document");
    await window.openEditor(`/browse?domain=${fooDomain}`)
    await editor.leftNavigation.assertCurrentAccount(fooAccountName)
    await editor.browse.assertLoadedItem("Foo Document");
    await window.page.reload();
    await editor.leftNavigation.assertCurrentAccount(fooAccountName)
    await editor.browse.assertLoadedItem("Foo Document");

});
