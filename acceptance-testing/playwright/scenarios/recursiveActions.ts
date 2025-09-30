import { EditorSections } from "../sections/editor/editorsections";
import { ItemHierarchy } from "../../config/boilerplate/contract";
import { ReaderSections } from "../sections/reader/readersections";
import { TestCase } from "../fixtures";
import { extractTitle } from "../../shared/testDataUtils";

async function doRecursivePublish(editor: EditorSections): Promise<void> {
    await editor.browse.clickItemContextMenu("Test collection");
    await editor.browse.clickItemInContextMenu("Batch actions");
    await editor.batchActionsModal.publishFirstLanguage();
}

async function validateRecursivePublish(reader: ReaderSections, items: ItemHierarchy[]): Promise<void> {
    const titles = items.map(extractTitle);
    await reader.browser.openStoryByTitle("Test collection");
    for (const title of titles) {
        await reader.browser.expectStoryByTitle(title, true);
    }
}

async function doRecursiveDelete(editor: EditorSections, shouldBeBlocked: boolean) {
    await editor.browse.clickItemContextMenu("Test collection");
    await editor.browse.clickItemInContextMenu("Batch actions");
    await editor.batchActionsModal.delete(shouldBeBlocked, 7);
}

async function doRecursiveUnpublish(editor: EditorSections) {
    await editor.browse.clickItemContextMenu("Test collection");
    await editor.browse.clickItemInContextMenu("Batch actions");
    await editor.batchActionsModal.unpublishLanguage(0);
    await editor.browse.clickItemContextMenu("Test collection");
    await editor.browse.clickItemInContextMenu("Batch actions");
    await editor.batchActionsModal.unpublishLanguage(1)
}

async function validateRecursiveUnpublish(reader: ReaderSections, items: ItemHierarchy[]) {
    const titles = items.map(extractTitle);
    await reader.browser.openStoryByTitle("Test collection");
    for (const title of titles) {
        await reader.browser.expectNoStoryByTitle(title, true);
    }
}

async function validateRecursiveDelete(editor: EditorSections) {
    await editor.browse.expectItemToNotBeVisible("Test collection");
}

export class RecursiveActions extends TestCase {

    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        const items = this.testData.seedData.itemHierarchy.children[0].children;

        await doRecursivePublish(editor);
        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await validateRecursivePublish(reader, items);

        await doRecursiveDelete(editor, true);

        await doRecursiveUnpublish(editor);
        await validateRecursiveUnpublish(reader, items);

        await doRecursiveDelete(editor, false);
        await validateRecursiveDelete(editor);
    }
}
