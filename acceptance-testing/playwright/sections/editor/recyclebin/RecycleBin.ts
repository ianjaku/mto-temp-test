import { RecycleBinLocators } from "./RecycleBinLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class RecycleBin extends TestSection {

    private locators = new RecycleBinLocators(this.context);

    async assertItem(itemName: string): Promise<void> {
        await expect(this.locators.getItemWithName(itemName)).toBeVisible();
    }

    async assertItemNotVisible(itemName: string): Promise<void> {
        await expect(this.locators.getItemWithName(itemName)).toBeHidden();
    }
    
}
