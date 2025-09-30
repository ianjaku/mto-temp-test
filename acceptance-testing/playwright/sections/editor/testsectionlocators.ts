import { Page } from "playwright-core";
import { TestContext } from "../testcontext";

export class TestSectionLocators {

    protected page: Page;

    constructor(
        private readonly context: TestContext
    ) {
        this.page = context.page;
    }
    
}
