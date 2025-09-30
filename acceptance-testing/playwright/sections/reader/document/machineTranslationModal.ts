import { Locator } from "playwright-core";
import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class MachineTranslationModal extends TestSection {
    private readonly locators = new MachineTranslationModalLocators(this.context);

    async selectLanguage(languageLabelPart: string): Promise<void> {
        await this.locators.addLanguagesDropdown.click();
        await this.locators.languageInDropdown(languageLabelPart).click();
    }

}

class MachineTranslationModalLocators extends TestSectionLocators {
    addLanguagesDropdown = this.page.locator(".add-languages-dropdown");

    languageInDropdown(languageLabelPart: string): Locator {
        return this.page.locator(`.add-languages-dropdown .dropdown-field-label:has-text("${languageLabelPart}")`);
    }
}
