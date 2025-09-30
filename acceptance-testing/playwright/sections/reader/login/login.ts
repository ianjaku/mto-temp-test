import { LoginLocators } from "./loginlocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Login extends TestSection {

    private readonly locators = new LoginLocators(this.context);

    async loginWithEmailAndPass(
        email: string,
        password: string
    ): Promise<void> {
        await this.locators.login.fill(email);
        await this.locators.password.fill(password);
        await this.locators.submit.click();
        await this.page.waitForLoadState("load");
    }

    async expectErrorMessage(msg: string): Promise<void> {
        await this.locators.errorMsg.first().waitFor({ state: "visible" });
        await expect(await this.locators.errorMsg.first().innerText()).toEqual(msg);
    }

    async waitForLoginButton(): Promise<void> {
        await this.locators.submit.waitFor({ state: "visible" });
    }
}
