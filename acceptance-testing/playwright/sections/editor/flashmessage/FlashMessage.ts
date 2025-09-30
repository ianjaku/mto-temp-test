import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../testsectionlocators";
import { expect } from "@playwright/test";

export class FlashMessage extends TestSection {

    private locators = new FlashMessageLocators(this.context);

    async expectSuccessFlashMessage(flashMessageText?: string): Promise<void> {
        await expect(this.locators.successFlashMessage).toBeVisible();
        if (flashMessageText) {
            await expect(this.locators.successFlashMessage).toContainText(flashMessageText);
        }
    }

    async expectInfoFlashMessage(flashMessageText?: string): Promise<void> {
        await expect(this.locators.infoFlashMessage).toBeVisible();
        if (flashMessageText) {
            await expect(this.locators.infoFlashMessage).toContainText(flashMessageText);
        }
    }

}

export class FlashMessageLocators extends TestSectionLocators {

    successFlashMessage = this.page.locator(".flashmessage.success")
    infoFlashMessage = this.page.locator(".flashmessage.info")

}
