import { it, pwTest } from "../pwTest";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { createUniqueTestLogin } from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("WYSIWYG link editor", async ({ createWindow, seed }) => {
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
    await editor.composer.fillChunk(0, "Foo Bar. Call me");

    await it("Supports adding hyperlinks", async () => {
        await editor.composer.highlightChunkText(0, 4, 7);
        await editor.composer.clickTextEditorToolBarButton("Link");
        await editor.composer.linkEditor.assertLinkTitleContains("Bar");
        await editor.composer.linkEditor.fillLink("manual.to");
        await editor.shared.pressButton("Enter");
        await editor.composer.linkEditor.assertValidationErrorNotVisible();
        await editor.composer.linkEditor.clickSave();
        await editor.composer.focusChunk(0);
        await editor.shared.pressButton("KeyA"); // tests letter isn't included in link
        await editor.composer.assertChunkContainsRegex(0, /<a target="[^"]+" rel="[^"]+" href="https:\/\/manual.to">Bar<\/a>/);
    });

    await it("Supports editing urls and confirming with Enter", async () => {
        await editor.composer.clickWordInChunk(0, "Bar");
        await editor.composer.linkToolbar.assertAnchor("https://manual.to");
        await editor.composer.linkToolbar.clickEdit();
        await editor.composer.linkEditor.fillLinkTitle("Baz");
        await editor.composer.linkEditor.fillLink("https://manual.to/baz");
        await editor.shared.pressButton("Enter");
        await editor.composer.linkEditor.assertValidationErrorNotVisible();
        await editor.shared.pressButton("Enter");
        await editor.composer.assertChunkContainsRegex(0, /<a target="[^"]+" rel="[^"]+" href="https:\/\/manual.to\/baz">Baz<\/a>/);
    });

    await it("Allows removing a link", async () => {
        await editor.composer.clickWordInChunk(0, "Baz");
        await editor.composer.linkToolbar.clickRemove();
        await editor.composer.assertChunkContainsRegex(0, /<a target="[^"]+" rel="[^"]+" href="https:\/\/manual.to\/baz">Baz<\/a>/, { not: true });
    });

    await it("Supports phone numbers", async () => {
        await editor.composer.highlightChunkText(0, 1, 3);
        await editor.composer.clickTextEditorToolBarButton("Link");
        await editor.composer.linkEditor.fillLink("0123456789");
        await editor.shared.pressButton("Enter");
        await editor.composer.linkEditor.assertValidationErrorNotVisible();
        await editor.composer.linkEditor.clickSave();
        await editor.composer.assertChunkContainsRegex(0, /<a target="[^"]+" rel="[^"]+" href="tel:0123456789">oo<\/a>/);
        await editor.composer.clickWordInChunk(0, "oo");
        await editor.composer.linkToolbar.assertAnchor("tel:0123456789");
    });

    await it("Shows error message when link is invalid, but still allows saving", async () => {
        await editor.composer.highlightChunkText(1, 0, 6);
        await editor.composer.clickTextEditorToolBarButton("Link");
        await editor.composer.linkEditor.fillLink("http://incomplete");
        await editor.composer.linkEditor.fillLinkTitle("Broken")
        await editor.composer.linkEditor.assertValidationErrorVisible();
        await editor.composer.linkEditor.clickSave();
        await editor.composer.clickWordInChunk(1, "Broken");
        await editor.composer.linkToolbar.assertAnchor("http://incomplete");
    });
});
