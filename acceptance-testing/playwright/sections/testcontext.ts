import { Page } from "playwright-core";

export class TestContext {

    constructor(
        readonly page: Page,
        readonly editorUrl: string,
        readonly readerUrl: string,
        readonly manageUrl?: string,
    ) { }

}
