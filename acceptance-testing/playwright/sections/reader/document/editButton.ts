import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class EditButton extends TestSection {

    private readonly buttonLocator = this.page.locator(".toolbarEditButton")
    private readonly buttonHiddenLocator = this.page.locator(".toolbarEditButton-hidden")

    async click(): Promise<string> {
        const [newTab] = await Promise.all([
            this.page.waitForEvent("popup"),
            this.buttonLocator.click()
        ]);
        return newTab.url();
    }

    async url(): Promise<string> {
        return this.buttonLocator.getAttribute("data-url");
    }

    async assertIsVisible(): Promise<void> {
        await expect(this.buttonLocator).toBeVisible();
    }

    async assertIsHidden(): Promise<void> {
        await expect(this.buttonHiddenLocator).toBeInViewport();
    }

}

