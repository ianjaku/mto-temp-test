import { Download } from "playwright-core";
import { TestSection } from "../../../testsection";
import { TestSectionLocators } from "../../testsectionlocators";
import { expect } from "@playwright/test";

export class PublishingPane extends TestSection {

    private locators = new PublishingPaneLocators(this.context);

    async openPane(): Promise<void> {
        await this.locators.openPaneButton.click();
    }

    async closePane(): Promise<void> {
        await this.locators.closePaneButton.click();
    }

    async changePrimaryLanguage(toLanguage: string): Promise<void> {
        await this.locators.primaryLanguagePublicationSwitcher.click();
        await this.locators.switchLanguageDropdown.type(toLanguage);
        await this.locators.switchLanguageDropdownFirstElement.click();
    }

    async unpublishPrimaryLanguage(): Promise<void> {
        await expect(this.locators.primaryLanguagePublishToggle).toHaveClass(/toggle-button--is-toggled/);
        await this.locators.primaryLanguagePublishToggle.click();
        await expect(this.locators.primaryLanguagePublishToggle).not.toHaveClass(/toggle-button--is-toggled/);
    }

    async exportPdf(title: string): Promise<Download> {
        const pdfBtn = this.page.locator(".settingsPane-table-row")
            .filter({ hasText: title })
            .locator("button:has-text(\"picture_as_pdf\")");
        await pdfBtn.click();
        await this.page.locator(".export-publication-pdf-modal .button:has-text(\"Export\")").click();
        return this.page.waitForEvent("download");
    }
}

export class PublishingPaneLocators extends TestSectionLocators {

    openPaneButton = this.page.locator(".rightPane >> .pane-item-icon:has-text(\"language\")");
    closePaneButton = this.page.locator(".drawer-container-header-icon.Publishing");
    primaryLanguagePublishToggle = this.page.locator(".settingsPane-table-row").nth(0).locator(".isPublishedToggle");
    primaryLanguagePublicationSwitcher = this.page.locator(".languagecode-circle--is-master");
    switchLanguageDropdown = this.page.locator(".add-languages-dropdown > input.filterable-dropdown-input");
    switchLanguageDropdownFirstElement = this.page.locator(".add-languages-dropdown ul.dropdown-elements > li.dropdown-field-label");
}