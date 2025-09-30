import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Editor comments", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Share me",
                type: "collection",
            }],
            roles: {
                Editor: [login]
            }
        },
    });

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItemContextMenu("Share me");
    await editor.browse.clickItemInContextMenu("Edit");
    await editor.collectionEditModal.switchToTab("Share");
    await editor.collectionEditModal.fillSemanticLinkInput("share-me");
    await editor.collectionEditModal.clickSemanticLinkContextMenuTrigger("share-me");
    await editor.collectionEditModal.clickSemanticLinkContextMenuItem("qr");
    await editor.collectionEditModal.clickCopyLink();
});
