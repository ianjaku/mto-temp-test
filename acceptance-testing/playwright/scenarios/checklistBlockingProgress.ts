import { TestCase } from "../fixtures";

export class ChecklistAllBlockingProgress extends TestCase {
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

        await reader.document.waitForChunksCount(1);
        await reader.document.waitForNthActiveChunk(0);

        await reader.document.toggleChecklistInActiveChunk();
        await reader.document.goToNextChunk();
        await reader.document.waitForChunksCount(2);
        await reader.document.waitForNthActiveChunk(1);

        await reader.document.toggleChecklistInActiveChunk();
        await reader.document.goToNextChunk();
        await reader.document.waitForChunksCount(3);
        await reader.document.waitForNthActiveChunk(2);

        await reader.document.toggleChecklistInActiveChunk();
        await reader.document.waitForChunksCount(3);

        await editor.composer.openContextMenuChecklistProgress();
        await editor.modals.checklistProgress.expectRows([
            { percentage: 100, step: 3 },
            { percentage: 67, step: 2 },
            { percentage: 33, step: 1 }
        ]);
    }
}

export class ChecklistSomeBlockingProgress extends TestCase {
    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();

        await editor.composer.fillTitle("Title and first chunk");
        await editor.composer.fillNewChunk("second chunk");
        await editor.composer.fillNewChunk("third chunk");
        await editor.composer.fillNewChunk("fourth chunk");
        await editor.composer.toggleChunkCheckable(1);
        await editor.composer.toggleChunkCheckable(3);
        await editor.composer.publish(true);

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await reader.browser.openStoryByTitle("Title and first chunk");

        await reader.document.waitForChunksCount(2);
        await reader.document.waitForNthActiveChunk(0);

        await reader.document.goToNextChunk();
        await reader.document.waitForChunksCount(2);
        await reader.document.waitForNthActiveChunk(1);

        await reader.document.toggleChecklistInActiveChunk();

        await reader.document.goToNextChunk();
        await reader.document.waitForChunksCount(4);
        await reader.document.waitForNthActiveChunk(2);

        await reader.document.goToNextChunk();
        await reader.document.waitForNthActiveChunk(3);

        await reader.document.toggleChecklistInActiveChunk();

        await editor.composer.openContextMenuChecklistProgress();
        await editor.modals.checklistProgress.expectRows([
            { percentage: 100, step: 2 },
            { percentage: 50, step: 1 },
        ]);
    }
}
