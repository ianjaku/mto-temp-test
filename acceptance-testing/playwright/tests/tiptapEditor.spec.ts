import { it, pwTest } from "../pwTest";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("TipTap Editor", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "WYSIWYG document",
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

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();

    await editorWindow.overrideLaunchDarklyFlag(LDFlags.USE_TIP_TAP, true);

    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");
    await editor.browse.clickItem("WYSIWYG document");

    await it("Formats with bold", async () => {
        await editor.composer.fillChunk(0, "Foo Bar");
        await editor.composer.highlightChunkText(0, 4, 7);
        await editor.composer.assertTextEditorToolBarVisible();
        await editor.composer.clickTextEditorToolBarButton("Bold");
        await editor.composer.assertTextEditorToolBarButtonActive("Bold");
        await editor.composer.assertChunkContainsHTML(0, "<strong>Bar</strong>");
    });

    await it("Undoes changes with Ctrl+Z", async () => {
        await editor.composer.fillChunk(0, "Foo Bar");
        await editor.composer.assertChunkContainsHTML(0, "<p>Foo Bar</p>");
        await editor.composer.typeIntoChunk(0, " Changed");
        await editor.composer.assertChunkContainsHTML(0, "<p>Foo Bar Changed</p>");
        await editor.composer.focusChunk(0);
        await editor.composer.ctrlZ();
        await editor.composer.assertChunkContainsHTML(0, new RegExp("(<p>Foo Bar</p>)|(<strong>Bar</strong>)"));
        await editor.composer.focusChunk(0);
        await editor.composer.ctrlShiftZ();
        await editor.composer.assertChunkContainsHTML(0, "<p>Foo Bar Changed</p>");
    });
});
