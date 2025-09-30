import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../testsectionlocators";
import { expect } from "@playwright/test";

class AccountAnalyticsLocators  extends TestSectionLocators {
    userActionRows = this.page.locator(".account-analytics-table-wrapper >> tbody tr")

    contentFilter = this.page.locator(".filterForm-chosenDocs");
    contentFilterEmpty = this.contentFilter.locator("text=\"All documents available to me\"");
    contentFilterChip = this.contentFilter.locator(".filterForm-chip");

    userFilter = this.page.locator(".filterForm-chosenUsers");
    userFilterEmpty = this.userFilter.locator("text=\"All users\"");
    userFilterChip = this.userFilter.locator(".filterForm-chip");
    userFilterUserTab = this.page.locator(".modal >> text=Users");

    userActionsFilter = this.page.locator(".filterForm-chosenUserActions");
    userActionsFilterEmpty = this.userActionsFilter.locator("text=\"All actions\"");
    userActionsFilterChip = this.userActionsFilter.locator(".filterForm-chip");

    chooseFilter = this.page.getByText("Choose", { exact: true });

    applyFilter = this.page.locator("text=\"Apply filters\"");
    cancelApplyFilter = this.page.locator("text=\"Cancel\"");
}

export interface UserActionFilter {
    users?: string[];
    groups?: string[];
    content?: string[];
    actions?: string[];
}
export class AccountAnalytics extends TestSection {

    private readonly locators = new AccountAnalyticsLocators(this.context);

    async expectNumberOfActions(number: number): Promise<void> {
        await expect(this.locators.userActionRows).toHaveCount(number);
    }

    async setFilter(filter: UserActionFilter): Promise<void> {
        if (filter.users && filter.groups) {
            throw new Error("Not implemented yet: Cannot set both users and groups filters at the same time");
        }
        await this.clearAllFilters();
        if (filter.users) {
            await this.applyUserFilter(filter.users);
        }
        if (filter.groups) {
            await this.applyUsergroupFilter(filter.groups);
        }
        if (filter.content) {
            await this.applyContentFilter(filter.content);
        }
        if (filter.actions) {
            await this.applyUserActionFilter(filter.actions);
        }
        await this.applyFilter();
    }

    private async clearAllFilters(): Promise<void> {
        while (await this.locators.contentFilterChip.count()) {
            await this.locators.contentFilter.locator("svg").nth(0).click();
        }
        while (await this.locators.userFilterChip.count()) {
            await this.locators.userFilterChip.locator("svg").nth(0).click();
        }

        while (await this.locators.userActionsFilterChip.count()) {
            await this.locators.userActionsFilterChip.locator("svg").nth(0).click();
        }
    }

    private async applyFilter(): Promise<void> {
        await this.locators.applyFilter.click();
    }

    private async applyUserFilter(users: string[]): Promise<void> {
        await this.locators.userFilterEmpty.click();
        await this.locators.userFilterUserTab.click();
        for (const user of users) {
            await this.page
                .getByRole("row", { name: user })
                .getByRole("checkbox")
                .check();
        }
        await this.locators.chooseFilter.click();
    }

    private async applyUsergroupFilter(groups: string[]): Promise<void> {
        await this.locators.userFilterEmpty.click();
        for (const group of groups) {
            await this.page
                .getByRole("row", { name: group })
                .getByRole("checkbox")
                .check();
        }
        await this.locators.chooseFilter.click();
    }

    private async applyContentFilter(itemPath: string[]): Promise<void> {
        await this.locators.contentFilterEmpty.click();
        for (let i = 0; i < itemPath.length - 1; i++) {
            await this.page
                .locator(".tree-navigator-row")
                .filter({ hasText: itemPath[i] })
                .getByText("keyboard_arrow_right")
                .click();
        }
        await this.page
            .locator(".tree-navigator-row")
            .filter({ hasText: itemPath[itemPath.length - 1] })
            .click();

        await this.locators.chooseFilter.click();
    }

    async expectNotPresentInContentFilter(item: string): Promise<void> {
        await this.locators.contentFilterEmpty.click();
        await expect(this.page.locator(".tree-navigator-row").filter({ hasText: item }))
            .not.toBeVisible({ timeout: 10_000 });
        await this.locators.cancelApplyFilter.click();
    }

    private async applyUserActionFilter(actions: string[]): Promise<void> {
        await this.locators.userActionsFilterEmpty.click();
        for (const action of actions) {
            await this.page.getByLabel(action, { exact: true }).check();
        }
        await this.locators.chooseFilter.click();
    }
}
