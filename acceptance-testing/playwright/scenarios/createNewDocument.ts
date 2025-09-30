import { TestCase } from "../fixtures"


export class CreateNewDocument extends TestCase {

    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const editor = await window.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();
        await window.expectUrl(/\/documents\//);
    }

}