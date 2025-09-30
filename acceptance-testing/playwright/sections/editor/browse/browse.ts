import { BrowseLocators } from "./browselocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Browse extends TestSection {

    private readonly locators = new BrowseLocators(this.context);

    assertInEmptyCollection = () => this.locators.emptyCollectionLbl.waitFor()
    assertNoPermissionsError = () => expect(this.locators.fallbackError).toContainText("You don't have permissions to edit anything in this account.")
    assertLoadedItem = (itemName: string) => this.locators.getLoadedItem(itemName).waitFor();

    async assertNewButtonHidden(): Promise<void> {
        const newButton = this.page.locator(".navbar-create-button");
        const isButtonAbsentOrInvisible = await newButton.count() === 0 || !(await newButton.isVisible());
        if (!isButtonAbsentOrInvisible) {
            throw new Error("New button is visible or exists on the page");
        }
    }

    clickItem = (itemName: string) => this.locators.getItem(itemName).click()
    clickItemContextMenu = (itemName: string) => this.locators.getItemContextMenu(itemName).click()
    clickItemInContextMenu = (itemName: string) => this.sharedLocators.getContextMenuItem(itemName).click()
    clickLoadedItem = (itemName: string) => this.locators.getLoadedItem(itemName).click()
    clickShareButton = (itemName: string) => this.locators.getItemShareButton(itemName).click();
    clickUnpublishedItem = (itemName: string) => this.locators.getUnpublishedItem(itemName).click()

    async closeItemContextMenu() {
        await this.page.click("body");
    }

    expectItemProgressBar = (itemName: string, progressValue: number) => expect(itemName).toEqual(progressValue)
    expectItemProgressBarValue = (itemTitle: string, percentage: number) => expect(this.locators.itemWithProgressBarValue(itemTitle, percentage)).toBeVisible()
    expectItemToBeEditable = (itemTitle: string) => expect(this.locators.getItem(itemTitle)).not.toHaveClass(/library-row-isReadonly/)
    expectItemToBeReadonly = (itemTitle: string) => expect(this.locators.getItem(itemTitle)).toHaveClass(/library-row-isReadonly/)
    expectItemToNotBeVisible = (itemName: string) => this.locators.getItem(itemName).waitFor({ state: "hidden" })

    async expectNumberOfViews(expectedNumberOfViews: number, itemName: string): Promise<void> {
        const views = await this.locators.getItemViews(itemName).textContent();
        expect(views).toEqual(expectedNumberOfViews.toString());
    }

    async deleteItem(itemName: string): Promise<void> {
        await this.clickItemContextMenu(itemName);
        await this.clickItemInContextMenu("Remove");
        await this.sharedLocators.getButtonInModal("Yes").click();
    }

    shareButtonNotVisible = (itemName: string) => this.locators.getItemShareButton(itemName).isHidden();

    async startCreateNewCollection(): Promise<void> {
        await this.locators.activeNewButton.click();
        await this.locators.newCollectionOption.click();
    }

    async startCreateNewDocument(): Promise<void> {
        await this.locators.activeNewButton.click();
        await this.locators.newDocumentOption.click();
    }

    waitForLockedItem = (itemName: string) => this.locators.lockedItem(itemName).waitFor({ timeout: 10_000 })
    waitForUnlockedItem = (itemName: string) => this.locators.lockedItem(itemName).waitFor({ state: "hidden", timeout: 10_000 })

}
