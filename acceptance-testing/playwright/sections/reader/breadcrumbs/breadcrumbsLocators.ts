import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class BreadcrumbsLocators extends TestSectionLocators {

    breadcrumb(text: string): Locator {
        return this.page.locator(`.breadcrumbs-itemswrapper >> text=${text}`);
    }
}
