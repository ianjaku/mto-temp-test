import { Page } from "playwright-core";
import { SharedLocators } from "./shared/sharedlocators";
import { TestContext } from "./testcontext";

export class TestSection {

    protected page: Page;
    protected readerUrl: string;
    protected editorUrl: string;
    protected sharedLocators: SharedLocators;


    constructor(
        protected readonly context: TestContext
    ) {
        this.page = context.page;
        this.readerUrl = context.readerUrl;
        this.editorUrl = context.editorUrl;
        this.sharedLocators = new SharedLocators(context);

    }

    async wait(ms: number): Promise<void> {
        await this.page.waitForTimeout(ms);
    }

    async getCurrentUrl(): Promise<string> {
        return this.page.url();
    }

}
