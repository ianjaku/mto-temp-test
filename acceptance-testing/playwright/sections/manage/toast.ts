import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";

export class Toast extends TestSection {

    private readonly locators = new ToastLocators(this.context);

    async dismiss(): Promise<void> {
        await this.locators.toastClose.click();
    }

}

class ToastLocators extends TestSectionLocators {

    toastClose = this.page.locator("[role=status] button[toast-close]")

}
