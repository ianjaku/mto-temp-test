import { ErrorLocators } from "./errorLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Errors extends TestSection {

    private readonly locators = new ErrorLocators(this.context);

    async expectErrorMessage(msg: string): Promise<void> {
        await expect(this.locators.errorMsg).toBeVisible();
        await expect(this.locators.errorMsg).toContainText(msg);
    }

    async expectEmptyAccount(): Promise<void> {
        await expect(this.locators.emptyAccount).toBeVisible();
    }

    async expectText(msg: string): Promise<void> {
        await expect(this.page.locator(`text="${msg}"`)).toBeVisible();
    }
}
