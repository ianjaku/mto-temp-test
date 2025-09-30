import { RegisterPageLocators } from "./registerPageLocators";
import { TestSection } from "../../testsection";

export class RegisterPage extends TestSection {

    private readonly locators = new RegisterPageLocators(this.context);

    public async fillInForm(displayName: string, password: string): Promise<void> {
        await this.locators.displayNameInput.fill(displayName);
        await this.locators.passwordInput.fill(password);
        await this.locators.confirmPasswordInput.fill(password);
        await this.locators.submitButton.click();
    }
}
