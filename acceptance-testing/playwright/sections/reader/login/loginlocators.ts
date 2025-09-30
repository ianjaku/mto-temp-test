import { TestSectionLocators } from "../../editor/testsectionlocators";


export class LoginLocators extends TestSectionLocators {

    login = this.page.locator("[placeholder=\"Email\"]");
    password = this.page.locator("[placeholder=\"Password\"]");
    submit = this.page.locator("text=Login");
    errorMsg = this.page.locator(".errors .error");

}
