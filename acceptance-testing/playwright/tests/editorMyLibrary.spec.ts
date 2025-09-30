import { it, pwTest } from "../pwTest";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { expect } from "@playwright/test";

pwTest("Editor MyLibrary ", async ({ createWindow, fixtures, seed }) => {
    await it("shows error when the user doesn't have editor access to any item", async () => {
        const login = createUniqueTestLogin();
        const password = createUniqueTestLogin();
        await seed({
            features: [],
            users: [{ login, password }],
            items: {
                type: "collection",
                title: "Root collection",
                children: [{
                    title: "Hello World",
                    type: "document",
                    published: true,
                    chunks: ["First chunk"]
                }],
                roles: { Reader: [login] }
            },
        });

        const window = await createWindow();
        const editor = await window.openEditorAsUser(login, password);
        await editor.browse.assertNoPermissionsError();
        await window.close();
    });

    await it("stays on /browse and shows editable items when the user doesn't have access to the root collection", async () => {
        const login = createUniqueTestLogin();
        const password = createUniqueTestLogin();
        await seed({
            features: [],
            users: [{ login, password }],
            items: {
                type: "collection",
                title: "Root collection",
                children: [{
                    title: "Hello World",
                    type: "document",
                    published: true,
                    chunks: ["First chunk"],
                    roles: { Editor: [login] }
                }],
            },
        });

        const window = await createWindow();
        const editor = await window.openEditorAsUser(login, password);
        await editor.browse.assertLoadedItem("Hello World")
        await window.close();
    });

    await it("redirects to the root collection when the user has access to it", async () => {
        const login = createUniqueTestLogin();
        const password = createUniqueTestLogin();
        const rootCollection = await fixtures.items.getOrCreateRootCollection();
        await seed({
            features: [],
            users: [{ login, password }],
            items: {
                title: "Hello World",
                type: "document",
                published: true,
                chunks: ["First chunk"]
            },
        });

        const user = await fixtures.users.getUserByLogin(login);
        await fixtures.authorization.assignItemRole(rootCollection.id, user.id, "Editor");
        const window = await createWindow();
        const editor = await window.openEditorAsUser(login, password);
        await editor.browse.assertLoadedItem("Hello World")
        expect(window.page.url()).toMatch(new RegExp(`/browse/${rootCollection.id}$`))
        await window.close();
    });
});
