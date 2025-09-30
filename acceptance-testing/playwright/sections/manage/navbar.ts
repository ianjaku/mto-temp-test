import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";

export class Navbar extends TestSection {

    private readonly locators = new NavbarLocators(this.context);

    async clickItem(title: string): Promise<void> {
        await this.locators.item(title).click();
    }

}

class NavbarLocators extends TestSectionLocators {

    item = (title: string) => this.page.locator(`nav div:has-text('${title}')`)

}
