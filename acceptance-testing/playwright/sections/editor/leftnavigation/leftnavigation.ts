import { LeftNavigationLocators } from "./leftnavigationlocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";


export class LeftNavigation extends TestSection {

    private readonly locators = new LeftNavigationLocators(this.context);

    async clickMyLibrary(): Promise<void> {
        await this.locators.myLibrary.click();
    }

    async clickUsers(): Promise<void> {
        await this.locators.users.click();
    }

    async switchAccount(accountName: string): Promise<void> {
        await this.locators.accountSwitcher.click();
        await this.locators.accountSwitcherItem(accountName).click();
    }

    async assertCurrentAccount(accountName: string): Promise<void> {
        await this.locators.currentAccount.waitFor();
        await expect(this.locators.currentAccount).toHaveText(accountName);
    }

    async clickRecycleBin(): Promise<void> {
        await this.locators.recycleBin.click();
    }

    async createNewDocument(): Promise<void> {
        await this.locators.create.click();
        await this.locators.newDocument.click();
        await this.locators.confirmCreateButton.click();
    }

    async clickCreate(): Promise<void> {
        await this.locators.create.click();
    }

    async clickNewDocument(): Promise<void> {
        await this.locators.newDocument.click();
    }

    async clickNewCollection(): Promise<void> {
        await this.locators.newCollection.click();
    }

    async clickHome(): Promise<void> {
        await this.locators.home.click();
    }

    async clickAnalytics(): Promise<void> {
        await this.locators.analytics.click();
    }

}
