import { FEATURE_READONLY_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Readonly editor", async ({ createWindow, fixtures, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();

    const readerLogin = createUniqueTestLogin();
    const readerPassword = createUniqueTestLogin();

    await fixtures.users.create({
        type: UserType.Individual,
        password: readerPassword,
        login: readerLogin,
        displayName: "Reader User",
    });

    await seed({
        features: [FEATURE_READONLY_EDITOR],
        users: [{ login, password }],
        items: {
            title: "Root Collection",
            type: "collection",
            roles: { Admin: [login] },
            children: [
                {
                    title: "Readonly collection",
                    type: "collection",
                    roles: { Reader: [readerLogin] },
                    children: [
                        { title: "Readonly document", type: "document", roles: { Reader: [readerLogin] } },
                        { title: "Editable document", type: "document", roles: { Editor: [readerLogin] } },
                    ]
                },
                { title: "Hello World", type: "document" }
            ]
        }
    });

    const window = await createWindow();
    const editor = await window.openEditor();
    await editor.login.loginWithEmailAndPass(readerLogin, readerPassword);

    await editor.cookieBanner.acceptCookies();
    await editor.browse.expectItemToNotBeVisible("Hello World")
    await editor.browse.assertLoadedItem("Readonly collection");
    await editor.browse.clickItem("Readonly collection");
    await editor.browse.expectItemToBeReadonly("Readonly document")
    await editor.browse.expectItemToBeEditable("Editable document")

    await fixtures.disableFeatures([FEATURE_READONLY_EDITOR]);
    await window.page.reload();
    await editor.browse.expectItemToBeEditable("Readonly document")
    await editor.browse.expectItemToBeEditable("Editable document")
});
