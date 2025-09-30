import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class BreadcrumbsLocators extends TestSectionLocators {

    contextMenuButton = this.page.locator(".breadcrumbs-wrapper button.MuiButtonBase-root");

    getBreadcrumbWithName(name: string): Locator {
        return this.page.locator(`.breadcrumbs-wrapper .breadcrumbs-item >> text="${name}"`);
    }

    getFirstBreadcrumb(): Locator {
        return this.page.locator(".breadcrumbs-wrapper .breadcrumbs-item:first-child");
    }

}
