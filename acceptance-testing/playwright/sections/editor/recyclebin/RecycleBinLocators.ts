import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class RecycleBinLocators extends TestSectionLocators {

    getItemWithName(name: string): Locator {
        return this.page.locator(`.deletedItems-wrapper .library-row-content-title >> text="${name}"`);
    }

}
