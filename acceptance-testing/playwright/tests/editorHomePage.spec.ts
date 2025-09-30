import { FEATURE_COMMENTING_IN_EDITOR, FEATURE_DOCUMENT_OWNER } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Editor home page", async ({ createWindow, fixtures, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { itemTree } = await seed({
        features: [FEATURE_DOCUMENT_OWNER, FEATURE_COMMENTING_IN_EDITOR],
        users: [{ login, password, isAdmin: true }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Example document",
                type: "document",
                published: true,
                roles: {
                    Reader: [login],
                },
                languageCode: "en",
                chunks: [
                    "First chunk",
                    "Second chunk",
                ]
            }],
            roles: {
                Admin: [login]
            }
        },
    });
    const doc = itemTree.items.at(1);

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await window.overrideLaunchDarklyFlag(LDFlags.HOME_PAGE, true);
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.leftNavigation.clickHome();
    await editor.home.expectNothingToDo();

    const owner = await fixtures.users.getUserByLogin(login);
    await fixtures.ownership.setOwner(doc.id, owner.id);

    const bob = await fixtures.users.create({
        login: createUniqueTestLogin(),
        password: createUniqueTestLogin(),
        displayName: "Bob Foo",
    });
    await fixtures.authorization.assignItemRole(itemTree.root.id, bob.id, "Editor");

    await fixtures.readerComments.startNewThread(doc as Binder, 0, "en", "Test Comment", owner.id);

    await window.page.reload();
    await editor.home.expectActivity("Example document has 1 unresolved comment by you");

    await fixtures.readerComments.startNewThread(doc as Binder, 0, "en", "Hello World", bob.id);

    await window.page.reload();
    await editor.home.expectActivity("Example document has 2 unresolved comments by Bob Foo and you");

});
