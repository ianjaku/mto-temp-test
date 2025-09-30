import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class ReadConfirmation extends TestSection {

    private readonly locators = new ReaderFeedbackLocators(this.context);

    async expectNoReadConfirmationButton(): Promise<void> {
        await expect(this.locators.readConfirmationButton).not.toBeVisible();
    }

    async expectReadConfirmationButtonClickable(): Promise<void> {
        await this.locators.readConfirmationButton.click();
    }
}

class ReaderFeedbackLocators extends TestSectionLocators {
    readConfirmationButton = this.page.getByTestId("read-confirmation-button");
}
