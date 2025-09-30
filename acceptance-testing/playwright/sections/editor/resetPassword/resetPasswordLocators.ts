import { TestSectionLocators } from "../testsectionlocators";

export class ResetPasswordLocators extends TestSectionLocators {

    email = this.page.locator("input[name=\"email\"]");
    submit = this.page.locator(".editForm-confirm .button");
    feedbackMsg = this.page.locator(".editForm-feedback-item");

    confirm = this.page.locator("text=Confirm");
    newPassword = this.page.locator("//*[contains(@placeholder, \"Set a password\")]");
    newPasswordConfirm = this.page.locator("//*[contains(@placeholder, \"Repeat password\")]");
}
