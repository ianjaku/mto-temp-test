import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class Invite extends TestSection {

    private readonly locators = new InviteLocators(this.context);

    async clickSubmit(): Promise<void> {
        await this.locators.submit.click();
    }

    async expectDisplayNameValue(value: string): Promise<void> {
        await expect(this.locators.displayName).toHaveValue(value)
    }

    async expectSuccessMessage(msg: string): Promise<void> {
        await this.locators.successMsg.first().waitFor();
        expect(await this.locators.successMsg.first().innerText()).toEqual(msg);
    }

    async pressEnter(): Promise<void> {
        await this.locators.confirmPassword.press("Enter");
    }

    async submit(): Promise<void> {
        this.clickSubmit();
    }

    async fillIn({ displayName, password }: { displayName?: string; password?: string }): Promise<void> {
        if (displayName) await this.locators.displayName.fill(displayName);
        if (password) {
            await this.locators.password.fill(password);
            await this.locators.confirmPassword.fill(password);
        }
    }

}


export class InviteLocators extends TestSectionLocators {

    displayName = this.page.locator("input[name=displayName]");
    password = this.page.locator("input[name=password]");
    confirmPassword = this.page.locator("input[name=confirmPassword]");
    submit = this.page.locator(".editForm-confirm");
    successMsg = this.page.locator(".resetPassword-success");

}
