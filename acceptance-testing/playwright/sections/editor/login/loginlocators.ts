import { TestSectionLocators } from "../testsectionlocators";

export class LoginLocators extends TestSectionLocators {

    login = this.page.locator("[placeholder=\"Email address\"]");
    password = this.page.locator("[placeholder=\"Password\"]");
    submit = this.page.locator("text=Log in");
    errorMsg = this.page.locator(".login-box-errors label");
    loginBox = this.page.locator(".login-box");

}
