import { TestCase } from "../fixtures"


export class EditorSearchWithLanguageRestrictions extends TestCase {

    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const editor = await window.openEditorAndLogin();
        
        await editor.search.fillQueryAndSubmit("EnglishNonDialect");
        await editor.search.expectNumberOfResults(2);

        await editor.search.fillQueryAndSubmit("EnglishNonDialect lang:en");
        await editor.search.expectNumberOfResults(2);

        await editor.search.fillQueryAndSubmit("chunk lang:en-GB");
        await editor.search.expectNumberOfResults(1);

        await editor.search.fillQueryAndSubmit("sdlkfjsklfd");
        await editor.search.expectNumberOfResults(0);
    }

}