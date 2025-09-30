import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../testsectionlocators";

export class SharingModalLocators extends TestSectionLocators {

    copyLinkButton = this.page.getByTestId("composer-share-modal-copyLink");
    closeButton = this.page.getByTestId("composer-share-modal-close");
    languageDropdown = this.page.getByTestId("composer-share-modal-languageDropdown");
    linkDropdown = this.page.getByTestId("composer-share-modal-linkDropdown");

    getSelectableLanguage(languageName: string): Locator {
        return this.page.locator("[data-testid=\"composer-share-modal-languageDropdown\"] >> [data-testid=\"dropdown-element\"]", { hasText: languageName });
    }

    getSelectedLanguage(languageName: string): Locator {
        return this.page.locator("[data-testid=\"composer-share-modal-languageDropdown\"] >> [data-testid=\"dropdown-label\"]", { hasText: languageName });
    }

    getSelectableLinkByRegex(linkNameRegex: RegExp): Locator {
        return this.page.locator("[data-testid=\"composer-share-modal-linkDropdown\"] >> [data-testid=\"dropdown-element\"]", { hasText: linkNameRegex });
    }

    getSelectedLink(linkNameRegex: RegExp): Locator {
        return this.page.locator("[data-testid=\"composer-share-modal-linkDropdown\"] >> [data-testid=\"dropdown-label\"]", { hasText: linkNameRegex });
    }

}

