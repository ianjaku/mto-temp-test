import { TestCase } from "../fixtures";

export class BinderUserFeedbackNonAnonymous extends TestCase {

    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();

        await editor.composer.fillTitle("Title");
        await editor.composer.fillNewChunk("Second chunk");
        await editor.composer.publish(true);

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await reader.browser.openStoryByTitle("Title");

        await reader.document.waitForChunksCount(3);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();

        await reader.document.feedback.expectDisabledSubmit();
        await reader.document.feedback.expectMissingCheckboxStayAnonymous();
    }
}
