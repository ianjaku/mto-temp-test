import { TestSectionLocators } from "../../editor/testsectionlocators";

export class RegisterPageLocators extends TestSectionLocators {

    displayNameInput = this.page.locator(".editForm >> input[name=\"displayName\"]");
    passwordInput = this.page.locator(".editForm >> input[name=\"password\"]");
    confirmPasswordInput = this.page.locator(".editForm >> input[name=\"confirmPassword\"]");
    submitButton = this.page.locator(".editForm-confirm >> .button");
}
