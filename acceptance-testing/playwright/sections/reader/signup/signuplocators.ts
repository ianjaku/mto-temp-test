import { TestSectionLocators } from "../../editor/testsectionlocators";

export class SignUpLocators extends TestSectionLocators {

    emailInput = this.page.locator(".signup-form >> input[name=\"username\"]");
    submitButton = this.page.locator(".signup-form >> button");
    footNote = this.page.locator(".footnote");
}
