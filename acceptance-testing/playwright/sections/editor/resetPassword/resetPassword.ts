import { ResetPasswordLocators } from "./resetPasswordLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class ResetPassword extends TestSection {

    private readonly locators = new ResetPasswordLocators(this.context);

    async clickSubmit(): Promise<void> {
        await this.locators.submit.click();
    }

    async expectFeedbackMessage(msg: string): Promise<void> {
        await this.locators.feedbackMsg.first().waitFor();
        await expect(await this.locators.feedbackMsg.first().innerText()).toEqual(msg);
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

    async updatePassword(newPassword: string): Promise<void> {
        await this.locators.newPassword.fill(newPassword);
        await this.locators.newPasswordConfirm.fill(newPassword);
        await this.locators.confirm.click();
    }

}
