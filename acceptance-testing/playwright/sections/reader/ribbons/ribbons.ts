import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class Ribbons extends TestSection {

    private locators = new RibbonsLocators(this.context);

    async expectInfoRibbon(ribbonText?: string): Promise<void> {
        await expect(this.locators.infoRibbon).toBeVisible();
        if (ribbonText) {
            await expect(this.locators.infoRibbon).toContainText(ribbonText);
        }
    }

    async expectRibbonWithText(text: string): Promise<void> {
        await this.locators.ribbontWithText(text).waitFor({
            state: "visible"
        });
    }

    async expectNoRibbonWithText(text: string): Promise<void> {
        await this.locators.ribbontWithText(text).waitFor({
            state: "hidden"
        });
    }
}

class RibbonsLocators extends TestSectionLocators {

    infoRibbon = this.page.locator(".ribbon.ribbon--info")

    ribbontWithText(text: string) {
        return this.page.locator(`.ribbon >> text=${text}`);
    }

}
