import { Locator, Page } from "@playwright/test";
import { TestSectionLocators } from "../testsectionlocators";

export class LeftNavigationLocators extends TestSectionLocators {

    home = this.createNavbarLocator(this.page, "Home");
    create = this.createNavbarLocator(this.page, "Create");
    newDocument = this.page.locator("[data-testid='add-new-document-default']:visible");
    newCollection = this.page.locator(".contextMenu-item-option >> text=Collection >> visible=true");
    myLibrary = this.createNavbarLocator(this.page, "My Library");
    analytics = this.createNavbarLocator(this.page, "Analytics");
    users = this.createNavbarLocator(this.page, "Users");
    recycleBin = this.createNavbarLocator(this.page, "Recycle Bin");
    help = this.createNavbarLocator(this.page, "Help");
    confirmCreateButton = this.page.locator(".modal-footer .button:not(.button--disabled) >> text='Set it up'");
    accountSwitcherList = this.page.locator(".account-switcher.dropdown--is-open .dropdown-elements");
    accountSwitcher = this.page.locator(".account-switcher .dropdown-field");
    currentAccount = this.accountSwitcher.locator(".dropdown-field-label-group-text");

    private createNavbarLocator(page: Page, label: string) {
        const selector = `.navbar-main-navigation >> text=${label} >> visible=true`;
        return page.locator(selector);
    }

    public accountSwitcherItem(accountName: string): Locator {
        return this.accountSwitcherList.locator(`.dropdown-field-label:has-text('${accountName}')`)
    }
}
