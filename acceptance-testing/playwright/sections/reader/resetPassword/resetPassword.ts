import { ResetPasswordLocators } from "./resetPasswordLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class ResetPassword extends TestSection {

    private readonly locators = new ResetPasswordLocators(this.context);

    async clickSubmit(): Promise<void> {
        await this.locators.submit.click();
    }

    async expectSuccessMessage(msg: string): Promise<void> {
        await this.locators.successMsg.first().waitFor();
        await expect(await this.locators.successMsg.first().innerText()).toEqual(msg);
    }

    async fillEmail(email: string): Promise<void> {
        await this.locators.email.fill(email);
    }

    async pressEnter(): Promise<void> {
        await this.locators.email.press("Enter");
    }

    async submitResetEmail(email: string): Promise<void> {
        this.fillEmail(email);
        this.clickSubmit();
    }

    async updatePassword(password: string): Promise<void> {
        await this.locators.newPassword.fill(password);
        await this.locators.newPasswordConfirm.fill(password);
        await this.locators.confirm.click();
    }

}
