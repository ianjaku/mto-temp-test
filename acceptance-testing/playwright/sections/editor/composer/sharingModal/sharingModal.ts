import { SharingModalLocators } from "./sharingModalLocators";
import { TestSection } from "../../../testsection";

export class SharingModal extends TestSection {

    private locators = new SharingModalLocators(this.context);

    async openLanguageDropdown(): Promise<void> {
        await this.locators.languageDropdown.click();
    }

    async openLinkDropdown(): Promise<void> {
        await this.locators.linkDropdown.click();
    }

    async assertSelectableLanguage(languageName: string, options = { not: false }): Promise<void> {
        if (options.not) {
            await this.locators.getSelectableLanguage(languageName).waitFor({ state: "hidden" });
        } else {
            await this.locators.getSelectableLanguage(languageName).waitFor();
        }
    }

    async assertSelectedLanguage(languageName: string): Promise<void> {
        await this.locators.getSelectedLanguage(languageName).waitFor();
    }

    async assertSelectedLinkUsingRegex(regex: RegExp): Promise<void> {
        await this.locators.getSelectedLink(regex).waitFor();
    }

    async selectLanguage(languageName: string): Promise<void> {
        await this.locators.getSelectableLanguage(languageName).click();
    }

    async assertSelectableLinkUsingRegex(regex: RegExp, options = { not: false }): Promise<void> {
        if (options.not) {
            await this.locators.getSelectableLinkByRegex(regex).waitFor({ state: "hidden" });
        } else {
            await this.locators.getSelectableLinkByRegex(regex).waitFor();
        }
    }

    async clickCopyLink(): Promise<void> {
        await this.locators.copyLinkButton.click();
    }

    async clickClose(): Promise<void> {
        await this.locators.closeButton.click();
    }

}
