import { StoryBrowserLocators } from "./storybrowserlocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";
import { log } from "../../../../shared/logging";

export class StoryBrowser extends TestSection {

    private readonly locators = new StoryBrowserLocators(this.context);

    public async openStoryByTitle(title: string, exact?: boolean): Promise<void> {
        await this.locators.storyByTitle(title, exact).click();
    }

    async expectStoryByTitle(title: string, exact = false): Promise<void> {
        log(`Waiting for story title ${title}\n`);
        await expect(this.locators.storyByTitle(title, exact)).toBeVisible();
    }

    async expectNoStoryByTitle(title: string, exact = false): Promise<void> {
        await expect(this.locators.storyByTitle(title, exact)).toBeHidden();
    }

    async expectStoriesCount(expected: number): Promise<void> {
        await expect(this.locators.stories).toHaveCount(expected);
    }

    async expectLoggedInUser(user: string): Promise<void> {
        await expect(this.locators.loggedInUser(user)).toBeVisible();
    }

    async changeLanguage(languageCode: string): Promise<void> {
        await this.page.locator(`label:has-text("${languageCode}")`).click();
    }

    async expectEmptyCollectionMessage(): Promise<void> {
        const text = await this.locators.emptyCollectionMessage().innerText();
        expect(text).toBe("This collection is currently empty");
    }

    async goToHome(): Promise<void> {
        const url = new URL(this.page.url());
        url.pathname = "/browse"
        await this.page.goto(url.toString());
    }

    async expectItemProgressBarValue(itemTitle: string, percentage: number) {
        await expect(this.locators.itemWithProgressBarValue(itemTitle, percentage)).toBeVisible();
    }

}
