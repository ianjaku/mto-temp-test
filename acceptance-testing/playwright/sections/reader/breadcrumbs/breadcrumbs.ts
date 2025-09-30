import { BreadcrumbsLocators } from "./breadcrumbsLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";


export class Breadcrumbs extends TestSection {

    private readonly locators = new BreadcrumbsLocators(this.context);

    async expectBreadcrumbs(breadcrumbs: string[]): Promise<void> {
        for (const breadcrumb of breadcrumbs) {
            await expect(this.locators.breadcrumb(breadcrumb)).toBeVisible();
        }
    }

    async expectNoBreadcrumbs(breadcrumbs: string[]): Promise<void> {
        for (const breadcrumb of breadcrumbs) {
            await expect(this.locators.breadcrumb(breadcrumb)).toBeHidden();
        }
    }
}