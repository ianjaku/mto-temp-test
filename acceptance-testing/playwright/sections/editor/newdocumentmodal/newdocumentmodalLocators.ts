import { TestSectionLocators } from "../testsectionlocators";

export class NewDocumentModalLocators extends TestSectionLocators {

    public collection(name: string) {
        return this.page.locator(`.tree-navigator-row:has-text("${name}")`)
    }

}
