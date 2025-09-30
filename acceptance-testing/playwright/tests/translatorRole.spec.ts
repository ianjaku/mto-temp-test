import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_TRANSLATOR_ROLE
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import ts from "@binders/client/lib/i18n/translations/en_US";

pwTest("Translator role", async ({ createWindow, seed }) => {

    const [ adminLogin, adminPassword ] = [ createUniqueTestLogin(), createUniqueTestLogin() ];
    const [ translatorLogin, translatorPassword ] = [ createUniqueTestLogin(), createUniqueTestLogin() ];
    const rootCollectionTitle = "Root collection";
    const documentTitle = "Multi-lang doc";
    await seed({
        features: [FEATURE_TRANSLATOR_ROLE, FEATURE_APPROVAL_FLOW],
        users: [
            { login: adminLogin, password: adminPassword },
            { login: translatorLogin, password: translatorPassword },
        ],
        items: {
            type: "collection",
            title: "Root collection",
            roles: {
                Admin: [adminLogin],
                Reader: [translatorLogin],
            },
            children: [
                {
                    title: documentTitle,
                    type: "document",
                    published: false,
                    languageCode: "en",
                    chunks: [
                        "First chunk",
                        "Second chunk",
                    ],
                }
            ]
        }
    });

    // 1. As an admin, grant translator role to a user
    const adminEditorWindow = await createWindow();
    adminEditorWindow.page.setDefaultTimeout(10_000);
    const adminEditor = await adminEditorWindow.openEditorAsUser(adminLogin, adminPassword);

    await adminEditor.browse.clickItemContextMenu(rootCollectionTitle);
    await adminEditor.browse.clickItemInContextMenu("Access");
    await adminEditor.accessModal.addUserAccess(translatorLogin, "Translator", { translatorLanguage: "Romanian" });
    await adminEditor.accessModal.clickDone();
    await adminEditorWindow.page.close();

    // 2. As a translator
    const translatorEditorWindow = await createWindow();
    translatorEditorWindow.page.setDefaultTimeout(10_000);
    const translatorEditor = await translatorEditorWindow.openEditorAsUser(translatorLogin, translatorPassword);
    await translatorEditor.browse.clickItem(rootCollectionTitle);

    // Ensure no permission to create new documents/collections
    await translatorEditor.browse.assertNewButtonHidden();

    // Ensure prompt for adding the translation to the doc
    await translatorEditor.browse.clickItem(documentTitle);
    await translatorEditor.modals.waitForModalTitle("Add a new language");
    await translatorEditor.composer.wait(1000);  // Avoid a race condition with the flux store
    await translatorEditor.modals.clickButton("Yes");

    // Close secondary language
    await translatorEditor.composer.closeSecondaryLanguage();

    // Ensure main language not editable
    // expect delete chunk not available
    await translatorEditor.composer.expectLanguageNotEditable();
    await translatorEditor.composer.expectPublishButtonDisabled();

    // Switching to editable language
    await translatorEditor.composer.switchToLanguage("Romanian");
    // Ensure Editing is allowed
    await translatorEditor.composer.fillTitle("Rolul de traducator", false);
    await translatorEditor.composer.typeIntoChunk(0, "Prima bucata");
    await translatorEditor.composer.typeIntoChunk(1, "A doua bucata");
    // Ensure chunk approval and publishing works
    await translatorEditor.composer.approveAll();
    await translatorEditor.modals.chunkApproval.expectModalBodyTextToContain(ts.Edit_ChunkApproveAllConfirm.replace("{{count}}", "3"));
    await translatorEditor.modals.chunkApproval.confirm();
    await translatorEditor.composer.publish(true);
    // But adding / deleting chunks is forbidden
    await translatorEditor.composer.expectEmptyChunkNotEditable();
    await translatorEditor.composer.expectChunksMergeNotAllowed();
});
