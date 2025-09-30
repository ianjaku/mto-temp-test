import { TestSectionLocators } from "../../editor/testsectionlocators";

export class ResetPasswordLocators extends TestSectionLocators {

    email = this.page.locator("input.resetPassword-form-input");
    submit = this.page.locator(".resetPassword-form-button");
    successMsg = this.page.locator(".resetPassword-success");

    confirm = this.page.locator("text=Confirm");
    newPassword = this.page.locator("//*[contains(@placeholder, \"Set a password\")]");
    newPasswordConfirm = this.page.locator("//*[contains(@placeholder, \"Repeat password\")]");

}
