import { ReaderFeedbackSettingsModalLocators } from "./readerFeedbackSettingsModalLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class ReaderFeedbackSettingsModal extends TestSection {

    private readonly locators = new ReaderFeedbackSettingsModalLocators(this.context);

    async toggleRating(): Promise<void> {
        await this.locators.getRatingToggle().click();
    }

    async toggleComments(): Promise<void> {
        await this.locators.getCommentsToggle().click();
    }

    async toggleReadConfirmation(): Promise<void> {
        await this.locators.getReadConfirmationToggle().click();
    }

    async clickDiscardChanges(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Discard changes").click();
    }

    async clickKeepEditing(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Keep editing").click();
    }

    async clickSave(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Save").click();
        await this.wait(50);
        const options = { modalHasText: undefined, waitForEnabled: false, isUnhoverable: true};
        await this.sharedLocators.getButtonInModal("Save", options).waitFor({ state: "hidden" })
    }

    async close(): Promise<void> {
        await this.sharedLocators.getModalCloseButton().click();
    }

    async itemRatingSetting(): Promise<boolean> {
        return this.locators.getRatingToggle().isChecked();
    }

    async itemCommentsSetting(): Promise<boolean> {
        return this.locators.getCommentsToggle().isChecked();
    }

    async isReadConfirmationSettingChecked(): Promise<boolean> {
        return this.locators.getReadConfirmationToggle().isChecked();
    }

    async assertReadConfirmationSettingChecked(value: boolean): Promise<void> {
        await expect(this.locators.getReadConfirmationToggle().isChecked()).resolves.toEqual(value);
    }

    async assertParentRatingToggle(enabled: boolean): Promise<void> {
        await this.locators.getParentRatingToggle(enabled).waitFor();
    }

    async assertParentCommentsToggle(enabled: boolean): Promise<void> {
        await this.locators.getParentCommentsToggle(enabled).waitFor();
    }

    async assertParentReadConfirmationToggle(enabled: boolean): Promise<void> {
        await this.locators.getParentReadConfirmationToggle(enabled).waitFor();
    }

    async assertIsUsingParentSettings(expectedValue: boolean): Promise<void> {
        await this.locators.getUseParentSettingsToggleWithValue(expectedValue).waitFor();
    }

    async modalTitle(): Promise<string> {
        return this.sharedLocators.getModalTitle().innerText();
    }

    async goBack(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Go back").click();
    }

    async goToParent(title: string): Promise<void> {
        await this.locators.goToParent(title).click();
    }

    async clickOverride(): Promise<void> {
        await this.locators.overrideBtn.click();
    }
}
