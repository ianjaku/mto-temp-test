/* eslint-disable no-console */
import { TestCase } from "../fixtures";
import { expect } from "@playwright/test";

export class ReaderFeedbackSetup extends TestCase {
    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();

        console.error("Before rootCollection context menu click");
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.toggleComments();
        await editor.readerFeedbackSettingsModal.clickSave();

        await editor.browse.clickItemContextMenu(this.testData.seedData.itemHierarchy.children[0].name);
        await editor.browse.clickItemInContextMenu("Feedback settings");

        await editor.readerFeedbackSettingsModal.assertParentRatingToggle(true);
        await editor.readerFeedbackSettingsModal.assertParentCommentsToggle(false);
        await editor.readerFeedbackSettingsModal.goToParent(this.testData.seedData.rootCollection);

        await editor.readerFeedbackSettingsModal.toggleRating();
        await editor.readerFeedbackSettingsModal.toggleComments();
        await editor.readerFeedbackSettingsModal.clickSave();
        await editor.readerFeedbackSettingsModal.close();

        console.error("Before context menu click L29");
        await editor.browse.clickItemContextMenu(this.testData.seedData.itemHierarchy.children[0].name);
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertParentRatingToggle(false);
        await editor.readerFeedbackSettingsModal.assertParentCommentsToggle(true);
        await editor.readerFeedbackSettingsModal.clickOverride();
        await editor.readerFeedbackSettingsModal.toggleRating();
        await editor.readerFeedbackSettingsModal.clickSave();

        await editor.browse.clickItem(this.testData.seedData.itemHierarchy.children[0].name);
        console.error("Before context menu click L39");
        await editor.browse.clickItemContextMenu(this.testData.seedData.itemHierarchy.children[0].children[0].name);
        await editor.browse.clickItemInContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.assertParentRatingToggle(true);
        await editor.readerFeedbackSettingsModal.assertParentCommentsToggle(false);
    }
}

export class ReaderFeedbackSettingsDirtyState extends TestCase {
    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();

        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Feedback settings");
        await editor.readerFeedbackSettingsModal.toggleComments();
        await editor.readerFeedbackSettingsModal.clickSave();

        await editor.browse.clickItemContextMenu(this.testData.seedData.itemHierarchy.children[0].name);
        await editor.browse.clickItemInContextMenu("Feedback settings");

        await editor.readerFeedbackSettingsModal.assertParentRatingToggle(true);
        await editor.readerFeedbackSettingsModal.assertParentCommentsToggle(false);
        await editor.readerFeedbackSettingsModal.goToParent(this.testData.seedData.rootCollection);

        await editor.readerFeedbackSettingsModal.toggleRating();
        await editor.readerFeedbackSettingsModal.toggleComments();
        await editor.readerFeedbackSettingsModal.close();

        await expect(await editor.readerFeedbackSettingsModal.modalTitle()).toEqual("Discard changes?");
        await editor.readerFeedbackSettingsModal.clickKeepEditing();

        await expect(await editor.readerFeedbackSettingsModal.modalTitle()).toMatch(/Feedback settings for .*/);
        await expect(await editor.readerFeedbackSettingsModal.itemRatingSetting()).toBe(false);
        await expect(await editor.readerFeedbackSettingsModal.itemCommentsSetting()).toBe(true);

        await editor.readerFeedbackSettingsModal.close();

        await expect(await editor.readerFeedbackSettingsModal.modalTitle()).toEqual("Discard changes?");
        await editor.readerFeedbackSettingsModal.clickDiscardChanges();
        await editor.browse.clickItemContextMenu(this.testData.seedData.itemHierarchy.children[0].name);
    }
}
