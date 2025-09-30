import { it, pwTest } from "../pwTest";
import {
    FEATURE_READ_CONFIRMATION
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

pwTest("Editor read confirmation configuration", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [FEATURE_READ_CONFIRMATION],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Collection A",
            children: [
                {
                    type: "document",
                    title: "Document X",
                    chunks: [ "Nothing" ],
                    published: true,
                },
                {
                    type: "collection",
                    title: "Subcollection of A",
                    children: [
                        {
                            type: "document",
                            title: "Document Y",
                            chunks: [ "Nothing" ],
                            published: true,
                        },
                    ]
                }
            ],
            roles: {
                Admin: [login]
            }
        },
    });

    const editorWindow = await createWindow();
    const editor = await editorWindow.openEditorAsUser(login, password);

    await it("By default the read confirmation setting is off, but it can be changed", async () => {
        await editor.browse.clickItem("Collection A");
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertReadConfirmationSettingChecked(false);
        await editor.readerFeedbackSettingsModal.toggleReadConfirmation();
        await editor.readerFeedbackSettingsModal.assertReadConfirmationSettingChecked(true);
        await editor.readerFeedbackSettingsModal.clickSave();
    });

    await it("The child collection read confirmation can be different than parent's", async () => {
        await editor.browse.clickItemContextMenu("Subcollection of A");
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(true);
        await editor.readerFeedbackSettingsModal.assertParentReadConfirmationToggle(true);
        await editor.readerFeedbackSettingsModal.clickOverride();
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(false);
        await editor.readerFeedbackSettingsModal.assertReadConfirmationSettingChecked(false);
        await editor.readerFeedbackSettingsModal.clickSave();
    });

    await it("The child document read confirmation can be different than parent's", async () => {
        await editor.browse.clickItemContextMenu("Document X");
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(true);
        await editor.readerFeedbackSettingsModal.assertParentReadConfirmationToggle(true);
        await editor.readerFeedbackSettingsModal.clickOverride();
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(false);
        await editor.readerFeedbackSettingsModal.assertReadConfirmationSettingChecked(false);
        await editor.readerFeedbackSettingsModal.clickSave();
    });

    await it("A subcollection's child, inherits settings only from its direct parent", async () => {
        await editor.browse.clickItem("Subcollection of A");
        await editor.browse.clickItemContextMenu("Document Y");
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(true);
        await editor.readerFeedbackSettingsModal.assertParentReadConfirmationToggle(false);
        await editor.readerFeedbackSettingsModal.close();
    });

    await it("An instance has reader confirmation enable if any of its parents has it enabled", async () => {
        await editor.browse.clickItemContextMenu("Document Y");
        await editor.browse.clickItemInContextMenu("Create instance");
        await editor.translocationModal.treeNavigator.toParent();
        await editor.modals.clickButton("Create here");
        await editor.modals.waitForModalToClose();

        await editor.browse.clickItemContextMenu("Document Y");
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertIsUsingParentSettings(true);
        await editor.readerFeedbackSettingsModal.assertParentReadConfirmationToggle(true);
        await editor.readerFeedbackSettingsModal.close();
    });
    await editorWindow.close();

    const readerWindow = await createWindow();
    const reader = await readerWindow.openReaderAsUser(login, password);

    await it("The document with the read confirmation setting disabled does not display it in the reader", async () => {
        await reader.browser.openStoryByTitle("Document X");
        await reader.document.waitForChunksCount(1);
        await reader.document.readConfirmation.expectNoReadConfirmationButton();
    })

    await reader.document.clickUpButton();

    await it("The document with the read confirmation setting enabled displays it in the reader", async () => {
        await reader.browser.openStoryByTitle("Document Y");
        await reader.document.waitForChunksCount(2);
        await reader.document.goToNextChunk();
        await reader.document.readConfirmation.expectReadConfirmationButtonClickable();
    });
});
