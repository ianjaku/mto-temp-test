import { LinkToolbarLocators } from "./linkToolbarLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";

export class LinkToolbar extends TestSection {

    private locators = new LinkToolbarLocators(this.context);

    async assertAnchor(url: string): Promise<void> {
        await expect(this.locators.anchor).toContainText(url);
    }

    async clickEdit(): Promise<void> {
        await this.locators.editButton.click();
    }

    async clickRemove(): Promise<void> {
        await this.locators.removeButton.click();
    }
}
