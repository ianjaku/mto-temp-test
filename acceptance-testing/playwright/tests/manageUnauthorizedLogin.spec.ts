import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Manage unauthorized login", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [],
        users: [{ login, password, isAdmin: true }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Chunk Approval",
                type: "document",
                published: true,
                chunks: ["First chunk"],
            }],
            roles: { Admin: [login] }
        },
    });

    const window = await createWindow();
    const manage = await window.openManage("/login");
    await manage.login.loginWithEmailAndPass(login, password);
    await manage.login.expectErrorMessage(/.*you do not have access to the manage app/i);
});
