import { LinkEditorLocators } from "./linkEditorLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";
import ts from "@binders/client/lib/i18n/translations/en_US";

export class LinkEditor extends TestSection {

    private locators = new LinkEditorLocators(this.context);

    async assertLinkTitleContains(text: string): Promise<void> {
        await expect(this.locators.linkTitle).toHaveValue(text);
    }

    async assertValidationErrorVisible(): Promise<void> {
        await expect(this.locators.validationError).toBeVisible();
        await expect(this.locators.validationError).toHaveText(ts.Edit_LinkEditor_ValidationError);
    }

    async assertValidationErrorNotVisible(): Promise<void> {
        await expect(this.locators.validationError).not.toBeVisible();
    }

    async fillLinkTitle(title: string): Promise<void> {
        await this.locators.linkTitle.fill(title);
    }

    async fillLink(link: string): Promise<void> {
        await this.locators.link.fill(link);
    }

    async clickSave(): Promise<void> {
        await this.locators.saveButton.click();
    }
}
