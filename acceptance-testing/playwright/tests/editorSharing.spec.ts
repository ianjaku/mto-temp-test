import { it, pwTest } from "../pwTest";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { deserializeEditorStates } from "@binders/client/lib/draftjs/helpers";
import sleep from "@binders/binders-service-common/lib/util/sleep";

pwTest("Editor sharing", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    const { fixtures, itemTree } = await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [
                {
                    title: "shareable document nolang",
                    type: "document",
                    chunks: [
                        "First chunk",
                    ]
                },
                {
                    title: "shareable document multilang en",
                    type: "document",
                    published: true,
                    languageCode: "en",
                    chunks: [
                        "First chunk",
                    ]
                },
                {
                    title: "shareable collection",
                    type: "collection",
                }
            ],
            roles: {
                Editor: [login]
            }
        },
    });

    let sharableDocumentMultiLang = itemTree.items.at(2);
    const shareableCollection = itemTree.items.at(3);

    sharableDocumentMultiLang = await fixtures.items.addLanguageToDocument(deserializeEditorStates(sharableDocumentMultiLang), "partageable", "fr");
    await fixtures.items.publishDoc(sharableDocumentMultiLang.id, ["fr"]);
    await fixtures.items.addLanguageToDocument(deserializeEditorStates(sharableDocumentMultiLang), "teilbar-notpublished", "de");

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(login, password);
    await editor.cookieBanner.declineCookies();
    await editor.browse.clickItem("Root collection");

    async function waitForSemanticLink(id: string, semanticId: string, remainingWaitInMs = 10_000) {
        const links = await fixtures.routing.getSemanticLinks(shareableCollection.id);
        if (!links.some(link => link.semanticId === semanticId)) {
            if (remainingWaitInMs <= 0) {
                throw new Error(`Timed out waiting for semantic link ${semanticId} on ${id}`);
            }
            const waitPeriod = 100;
            await sleep(waitPeriod);
            return waitForSemanticLink(id, semanticId, remainingWaitInMs - waitPeriod);
        }

    }
    await it("collection is shareable", async () => {
        await editor.browse.clickItemContextMenu("shareable collection");
        await editor.browse.clickItemInContextMenu("Edit");
        await editor.collectionEditModal.switchToTab("Share");
        await editor.collectionEditModal.fillSemanticLinkInput("xxx");
        await editor.collectionEditModal.clickDone();
        await waitForSemanticLink(shareableCollection.id, "xxx");
        await editor.browse.clickShareButton("shareable collection");
        await editor.composer.sharingModal.openLanguageDropdown();
        await editor.composer.sharingModal.selectLanguage("Default language");
        await editor.composer.sharingModal.clickCopyLink();
        const tempWindow = await createWindow();
        await editor.shared.expectClipboardContent(tempWindow.getPage(), /.*\.manual\.to\/xxx.*/);
        await tempWindow.close();
        await editor.composer.sharingModal.clickClose();
    });

    await it("shared links are acessible and match the document", async () => {
        await editor.browse.clickItem("shareable document nolang");
        await editor.composer.assertShareButtonEnabledState(false);
        await editor.composer.publish();
        await editor.composer.assertShareButtonEnabledState(true);
        await editor.composer.clickShareButton();
        await editor.composer.sharingModal.assertSelectedLanguage("Default language");
        await editor.composer.sharingModal.assertSelectedLinkUsingRegex(/.*\.manual\.to\/shareable-document-nolang.*/);
        await editor.composer.sharingModal.clickCopyLink();
        const tempWindow = await createWindow();
        await editor.shared.expectClipboardContent(tempWindow.getPage(), /.*\.manual\.to\/shareable-document-nolang.*/);
        await tempWindow.close();
        await editor.composer.sharingModal.clickClose();
        await editor.breadcrumbs.clickBreadcrumb("Root collection");
    });

    await it("all published languages are visible", async () => {
        await editor.browse.clickItem("shareable document multilang");
        await editor.composer.assertShareButtonEnabledState(true);
        await editor.composer.clickShareButton();
        await editor.composer.sharingModal.openLanguageDropdown();
        await editor.composer.sharingModal.assertSelectableLanguage("English");
        await editor.composer.sharingModal.assertSelectableLanguage("French");
        await editor.composer.sharingModal.assertSelectableLanguage("German", { not: true });
        await editor.composer.sharingModal.openLinkDropdown();
        await editor.composer.sharingModal.assertSelectableLinkUsingRegex(/.*\.manual\.to\/shareable-document-multilang-en.*/);
        await editor.composer.sharingModal.assertSelectableLinkUsingRegex(/.*\.manual\.to\/partageable.*/, { not: true });
        await editor.composer.sharingModal.selectLanguage("French");
        await editor.composer.sharingModal.openLinkDropdown();
        await editor.composer.sharingModal.assertSelectableLinkUsingRegex(/.*\.manual\.to\/partageable.*/);
        await editor.composer.sharingModal.assertSelectableLinkUsingRegex(/.*\.manual\.to\/shareable-document-multilang-en.*/, { not: true });
        await editor.composer.sharingModal.clickClose();
    });

    await it("can add a new custom semantic link for a new language", async () => {
        await editor.rightPane.addLanguage("Dutch");
        await editor.composer.fillSecondaryTitle("deelbaar document");
        await editor.composer.fillSecondaryChunk(0, "Eerste chunk");
        await editor.composer.waitForAutoSave();
        await editor.composer.publishSecondary(true);
        await editor.rightPane.share.togglePane();
        await editor.rightPane.share.addSemanticLink("klikhier", "nl");
        await editor.rightPane.share.togglePane();
        await editor.breadcrumbs.clickBreadcrumb("Root collection");
    });

    await it("new language is shareable from browse view", async () => {
        await editor.browse.clickShareButton("shareable document multilang");
        await editor.composer.sharingModal.openLanguageDropdown();
        await editor.composer.sharingModal.assertSelectableLanguage("English");
        await editor.composer.sharingModal.assertSelectableLanguage("French");
        await editor.composer.sharingModal.assertSelectableLanguage("German", { not: true });
        await editor.composer.sharingModal.selectLanguage("Dutch");
        await editor.composer.sharingModal.assertSelectedLinkUsingRegex(/.*\.manual\.to\/klikhier/);
        await editor.composer.sharingModal.clickClose();
    });
});
