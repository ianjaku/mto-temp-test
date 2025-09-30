import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class TitleChunkLocators extends TestSectionLocators {

    title = this.page.locator(".title-chunk-title").locator("h1");
    readTimePill = this.page.locator("[data-testid=\"read-time\"]").locator(":nth-child(2)");
    lastUpdatedDatePill = this.page.locator("[data-testid=\"last-updated-at\"]").locator(":nth-child(2)");

}

export class TitleChunk extends TestSection {

    private readonly locators = new TitleChunkLocators(this.context);

    public async expectReadTime(readTime: string): Promise<void> {
        expect(await this.locators.readTimePill.innerText()).toEqual(readTime);
    }

    public async expectLastUpdatedDate(lastUpdatedDate: string): Promise<void> {
        expect(await this.locators.lastUpdatedDatePill.innerText()).toEqual(lastUpdatedDate);
    }

    public async expectTitle(title: string): Promise<void> {
        expect(await this.locators.title.innerText()).toEqual(title);
    }
}
