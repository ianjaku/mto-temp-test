import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class ContextMenuLocators extends TestSectionLocators {
    
    public popover = this.page.locator(".context-menu-popover");

    public getContextMenuItem(text: string): Locator {
        return this.page.locator(".context-menu-popover-paper .contextMenu-item", { has: this.page.locator(`text="${text}"`) });
    }
}
