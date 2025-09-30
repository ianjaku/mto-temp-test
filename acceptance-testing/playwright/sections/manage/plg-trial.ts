import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class PlgTrial extends TestSection {

    private readonly locators = new PlgTrialLocators(this.context);

    async confirmAll() {
        await this.locators.confirmAccount.check();
        await this.locators.confirmCollection.check();
        await this.locators.confirmEmail.check();
    }

    async expectSubmitState(state: "enabled" | "disabled") {
        if (state === "disabled") {
            expect(await this.locators.submit.isDisabled()).toBe(true);
        }
        if (state === "enabled") {
            await this.locators.enabledSubmit.waitFor();
            // expect(await this.locators.submit.isDisabled()).toBe(false);
        }
    }

    async fillUserEmail(email: string) {
        await this.locators.userEmail.type(email);
    }

    async fillUserCollectionName(name: string) {
        await this.locators.userCollection.type(name);
    }

    async clickSubmit() {
        await this.locators.submit.click();
    }

    async waitForSuccess() {
        await this.locators.successView.waitFor();
    }

}

class PlgTrialLocators extends TestSectionLocators {

    confirmAccount = this.page.locator("input#confirmationAccount")
    confirmCollection = this.page.locator("input#confirmationCollection")
    confirmEmail = this.page.locator("input#confirmationEmail")
    submit = this.page.locator("button:has-text(\"Submit\")")
    enabledSubmit = this.page.locator("button:not([disabled]):has-text(\"Submit\")")
    successView = this.page.locator(".bootstrap-success")
    userCollection = this.page.locator("input#userCollectionName")
    userEmail = this.page.locator("input#userEmail")

}

