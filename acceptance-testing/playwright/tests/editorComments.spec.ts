import { it, pwTest } from "../pwTest";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FEATURE_COMMENTING_IN_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Editor comments", async ({ createWindow, seed }) => {

    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { itemTree, fixtures, users } = await seed({
        features: [FEATURE_COMMENTING_IN_EDITOR],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Editor commenting document",
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
                Editor: [login]
            }
        },
    });

    const binder = itemTree.items.at(1) as unknown as Binder;
    const userId = users.at(0).id;
    await fixtures.editorComments.createOrphanedComment(binder, "Orphaned comment", "en", userId);

    const window = await createWindow();
    const editor = await window.openEditor("/login");
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();

    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("Editor commenting document");

    // Focus on the title BEFORE opening the pane otherwise PW won't find it
    await editor.composer.focusTitle();
    await editor.rightPane.comments.openPane();

    await it("Supports viewing orphaned comments", async () => {
        await editor.rightPane.comments.assertCommentText(0, 0, "Orphaned comment");
    });

    await it("Supports adding comments", async () => {
        await editor.composer.focusChunk(0);
        await editor.rightPane.comments.assertNoComments();
        await editor.rightPane.comments.clickNewThread();
        await editor.rightPane.comments.addNewComment("Test comment");
        await editor.rightPane.comments.assertCommentText(0, 0, "Test comment");
    })

    await it("Supports deleting comments", async () => {
        await editor.rightPane.comments.hoverComment(0, 0);
        await editor.rightPane.comments.toggleCommentContextMenu(0, 0);
        await editor.rightPane.comments.deleteCommentByActiveContextMenu();
        await editor.rightPane.comments.assertNoComments();
    });
});
