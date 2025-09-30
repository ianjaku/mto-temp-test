import { TestSectionLocators } from "../../editor/testsectionlocators";

export class ErrorLocators extends TestSectionLocators {

    errorMsg = this.page.locator(".reader-component-errorbox > p");
    emptyAccount = this.page.locator(".empty-account-title");

}
