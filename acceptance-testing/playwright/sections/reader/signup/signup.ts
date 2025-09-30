import { SignUpLocators } from "./signuplocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class SignUp extends TestSection {

    private readonly locators = new SignUpLocators(this.context);

    public async fillInForm(email: string): Promise<void> {
        await this.locators.emailInput.fill(email);
        await this.locators.submitButton.click();
        const message = await this.locators.footNote.innerText();
        expect(message.trim()).toEqual("(Make sure to check spam and other folders)");
    }
}
