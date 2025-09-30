import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class FlashMessage extends TestSection {

    private locators = new FlashMessageLocators(this.context);

    async expectErrorFlashMessage(flashMessageText?: string): Promise<void> {
        await expect(this.locators.errorFlashMessage).toBeVisible();
        if (flashMessageText) {
            await expect(this.locators.errorFlashMessage).toContainText(flashMessageText);
        }
    }

    async expectInfoFlashMessage(flashMessageText?: string): Promise<void> {
        await expect(this.locators.infoFlashMessage).toBeVisible();
        if (flashMessageText) {
            await expect(this.locators.infoFlashMessage).toContainText(flashMessageText);
        }
    }
}

class FlashMessageLocators extends TestSectionLocators {

    errorFlashMessage = this.page.locator(".flashmessage.flashmessage-severity-error")
    infoFlashMessage = this.page.locator(".flashmessage.flashmessage-severity-info")

}
