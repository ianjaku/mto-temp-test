import { Locator, expect } from "@playwright/test";
import { TestSection } from "../../testsection";
import { UsersLocators } from "./usersLocators";

enum UserTab {
    MANAGE = "Manage users",
    IMPORT = "Import Users",
    EMAILS = "Approved emails",
}

export interface UserRow {
    displayName: string;
    login: string;
    created: Date;
    lastOnline: Date | undefined;
}

async function extractDate(locator: Locator): Promise<Date | undefined> {
    const text = (await locator.innerText()).trim();
    if (text.length === 0) {
        return undefined;
    }
    const ms = Date.parse(text);
    if (Number.isNaN(ms)) {
        return undefined;
    }
    return new Date(ms);
}

export class Users extends TestSection {
    private readonly locators = new UsersLocators(this.context);

    async switchToUserAdministration(): Promise<void> {
        await this.locators.getUserAdministrationSwitchButton().click();
    }

    async ensureUserAdministrationTabActive(tab: UserTab): Promise<void> {
        const currentTabName = await this.locators.getActiveTab().textContent();
        if (currentTabName !== tab) {
            await this.locators.getTabWithName(tab).click();
        }
    }

    async csvImportUsers(file: { name: string, mimeType: string, buffer: Buffer }): Promise<void> {
        await this.ensureUserAdministrationTabActive(UserTab.IMPORT);
        await this.locators.importUsers.getOpenImportModalButton().click();
        const fileChoosePromise = this.page.waitForEvent("filechooser");
        await this.locators.importUsers.getUploadCsvFileButton().click();
        const fileChooser = await fileChoosePromise;
        await fileChooser.setFiles(file);
        await this.locators.importUsers.getConfirmCsvFileImportButton().click();
    }

    async deleteUser(login: string): Promise<void> {
        await this.ensureUserAdministrationTabActive(UserTab.MANAGE);
        await this.locators.manageUsers.getDeleteUserButton(login).click();
        await this.locators.manageUsers.getDeleteUserButtonConfirmation().click();
        await expect(this.locators.manageUsers.getUserRow(login)).toHaveCount(0, { timeout: 3_000 });
    }

    async setNewApprovedEmailPattern(pattern: string): Promise<void> {
        await this.ensureUserAdministrationTabActive(UserTab.EMAILS);
        await this.locators.approvedEmails.getNewApprovedEmailButton().click();
        await this.locators.approvedEmails.getApprovedEmailPatternInput().fill(pattern);
        await this.locators.approvedEmails.getConfirmApprovedEmailPatternButton().click();
    }

    async getUserDetails(login: string): Promise<UserRow> {
        let cells: Locator[] = [];
        const MINIMUM_CELLS = 4;
        const MAX_ATTEMPTS = 50;
        let attempts = 0;
        do {
            cells = await this.locators.manageUsers.getUserRow(login).locator("td").all();
            if (cells.length < MINIMUM_CELLS) {
                await this.wait(500);
                attempts++;
            }
        } while (cells.length < MINIMUM_CELLS && attempts < MAX_ATTEMPTS);

        if (cells.length < MINIMUM_CELLS) {
            throw new Error("Could not get user details")
        }

        const displayName = await cells[0].innerText();
        const created = await extractDate(cells[2]);
        if (created === undefined) {
            throw new Error("Invalid user creation date.");
        }
        const lastOnline = await extractDate(cells[3]);
        return {
            displayName,
            login,
            created,
            lastOnline
        }
    }
}