import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";


export class NotificationSettings extends TestSection {

    async closeModal(): Promise<void> {
        await this.page.locator(".modal-wrapper .modal-closeBtn").click();
    }

    async openTabByTitle(tabTitle: string): Promise<void> {
        await this.page.locator(`.notification-settings-wrapper .tabs-title >> text=${tabTitle}`).click();
    }

    async expectEmptyHistoryPane(): Promise<void> {
        const emptyTableComponent = this.page.locator(".notification-settings-wrapper .table-no-data");
        await expect(emptyTableComponent).toHaveText("No data found");
    }

    async expectHistoryTableRow(rowIndex: number, typeName: string, targetName: string): Promise<void> {
        await expect(this.page.locator(`.notification-settings-content .table tr:nth-child(${rowIndex + 1}) td:has-text("${targetName}")`)).toBeVisible();
        await expect(this.page.locator(`.notification-settings-content .table tr:nth-child(${rowIndex + 1}) td:has-text("${typeName}")`)).toBeVisible();
    }

    async addRecipient(eventTypeTitle: string, targetUserDisplayName: string): Promise<void> {
        await this.openTabByTitle("Recipients");

        await this.page.locator(".recipient-setting-wrapper--empty .dropdown-field").click();
        const eventType = this.page.locator(`.recipient-setting-wrapper--empty .dropdown-field-label-group-text:has-text("${eventTypeTitle}")`);
        await eventType.click();

        await expect(this.page.locator(".recipient-setting-wrapper--empty")).toBeHidden();

        const targetInput = this.page.locator(".recipient-setting-wrapper .userInput textarea");
        await targetInput.type(targetUserDisplayName);

        await this.page.locator(`.autocomplete-prompt-item:has-text("${targetUserDisplayName}")`).click();
    }

    async removeOnlyRecipient(): Promise<void> {
        await this.page.locator(".recipient-setting-remove").click();
    }
}
