import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class Login extends TestSection {

    private readonly locators = new LoginLocators(this.context);

    async loginWithEmailAndPass(email: string, password: string): Promise<void> {
        await this.locators.login.fill(email);
        await this.locators.password.fill(password);
        await this.locators.submit.click();
    }

    async expectErrorMessage(msg: string | RegExp, timeout?: number): Promise<void> {
        await this.locators.errorMsg.first().waitFor({ state: "visible", timeout });
        expect(await this.locators.errorMsg.first().innerText()).toMatch(msg);
    }

}

class LoginLocators extends TestSectionLocators {

    login = this.page.locator("input[name='username']");
    password = this.page.locator("input[name='password']");
    submit = this.page.locator("button:has-text('login')");
    errorMsg = this.page.locator(".errors");

}
