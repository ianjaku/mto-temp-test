import { TestCase } from "../fixtures";

export class ChecklistAllNonBlockingProgress extends TestCase {
    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();

        await editor.composer.fillTitle("Title and first chunk");
        await editor.composer.fillNewChunk("second chunk");
        await editor.composer.fillNewChunk("third chunk");
        await editor.composer.toggleChunkCheckable(0);
        await editor.composer.toggleChunkCheckable(1);
        await editor.composer.toggleChunkCheckable(2);
        await editor.composer.publish(true);

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await reader.browser.openStoryByTitle("Title and first chunk");

        await reader.document.waitForChunksCount(3);

        await reader.document.goToNextChunk();
        await reader.document.toggleChecklistInActiveChunk(2);
        await reader.document.toggleChecklistInActiveChunk();
        await reader.document.toggleChecklistInActiveChunk();

        await editor.composer.openContextMenuChecklistProgress();
        await editor.modals.checklistProgress.expectRows([
            { percentage: 33, step: 3 },
            { percentage: 67, step: 3 },
            { percentage: 33, step: 2 }
        ]);
    }
}

export class ChecklistSomeNonBlockingProgress extends TestCase {
    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();

        await editor.composer.fillTitle("Title and first chunk");
        // this chunk has to be bigger, because goToNextChunk will click the middle of the chunk HTML element,
        // which is coincidentally the checklist toggle button
        await editor.composer.fillNewChunk("second chunk\n\nlorem ipsum\n\ndolor sit amet");
        await editor.composer.fillNewChunk("third chunk");
        await editor.composer.fillNewChunk("fourth chunk");
        await editor.composer.toggleChunkCheckable(1);
        await editor.composer.toggleChunkCheckable(3);
        await editor.composer.publish(true);

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await reader.browser.openStoryByTitle("Title and first chunk");

        await reader.document.waitForChunksCount(4);

        await reader.document.goToNextChunk();
        await reader.document.toggleChecklistInActiveChunk(2);
        await reader.document.goToNextChunk();
        await reader.document.toggleChecklistInActiveChunk();

        await editor.composer.openContextMenuChecklistProgress();
        await editor.modals.checklistProgress.expectRows([
            { percentage: 100, step: 2 },
            { percentage: 50, step: 1 },
        ]);
    }
}
