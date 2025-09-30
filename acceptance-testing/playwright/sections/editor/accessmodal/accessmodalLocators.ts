import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class AccessModalLocators extends TestSectionLocators {

    addUserBtn: Locator = this.page.locator("button >> text=add_circle_outline");
    isPublicCheckbox = this.page.locator("label:has-text(\"Is public\") input[type=\"checkbox\"]");
    roleSelect: Locator = this.page.locator(".roleInput-selection");
    languagesDropdown: Locator = this.page.locator(".roleInput-selection >> .filterable-dropdown-arrow");
    showOnLandingPageCheckbox = this.page.locator("label:has-text(\"Show on landing page\") input[type=\"checkbox\"]");

    public getUserRow(username: string): Locator {
        return this.page.locator(".accessBox-table tr", { hasText: username });
    }

    public getDeleteButtonForUser(username: string): Locator {
        return this.page.locator(".accessBox-table tr", { hasText: username })
            .locator("button >> text=close");
    }

    public getRoleInSelect(roleName: string): Locator {
        return this.page.locator(`.roleInput-selection-elements .dropdown-field-label >> text="${roleName}"`);
    }

    getSelectionForLanguage(language: string): Locator {
        return this.page.locator(`.roleInput-selection >> .dropdown >> ul >> li:has-text("${language}")`);
    }
}
