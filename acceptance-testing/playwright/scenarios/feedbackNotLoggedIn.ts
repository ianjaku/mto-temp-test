import { TestCase } from "../fixtures";

export class BinderNotLoggedInFeedback extends TestCase {

    async run(): Promise<void> {
        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReaderIncognito();
        await reader.browser.openStoryByTitle("A public advertised doc");
        await reader.document.waitForChunksCount(3);
    }
}
