import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class NewCollectionModalLocators extends TestSectionLocators {
    nameInput: Locator = this.page.locator("input[placeholder=\"Collection name\"]");

}
