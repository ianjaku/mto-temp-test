import { LoginLocators } from "./loginlocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Login extends TestSection {

    private readonly locators = new LoginLocators(this.context);

    async loginWithEmailAndPass(email: string, password: string): Promise<void> {
        await this.locators.login.fill(email);
        await this.locators.password.fill(password);
        await this.locators.submit.click();
        await this.page.waitForLoadState("load");
    }

    async expectErrorMessage(msg: string, timeout?: number): Promise<void> {
        await this.locators.errorMsg.first().waitFor({ state: "visible", timeout });
        await expect(await this.locators.errorMsg.first().innerText()).toContain(msg);
    }

    async expectNoErrorMessage(): Promise<void> {
        const classNames = await this.locators.loginBox.getAttribute("class");
        await expect(classNames).not.toContain("login-box--containserrors");
    }
}
