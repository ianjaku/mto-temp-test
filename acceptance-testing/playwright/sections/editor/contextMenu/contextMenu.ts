import { ContextMenuLocators } from "./contextMenuLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class ContextMenu extends TestSection {
    private readonly locators = new ContextMenuLocators(this.context);

    async assertContextMenuItemDisabledState(itemName: string, expectedValue: boolean): Promise<void> {
        const contextMenuItem = this.locators.getContextMenuItem(itemName);
        const isDisabled = await contextMenuItem.evaluate((el) => el.classList.contains("Mui-disabled"));
        expect(isDisabled).toBe(expectedValue);
    }

    async clickItem(itemName: string): Promise<void> {
        await this.locators.getContextMenuItem(itemName).click();
    }

    async closeContextMenu(): Promise<void> {
        await this.locators.popover.click({ position: { x: 1, y: 1 } });
    }

}