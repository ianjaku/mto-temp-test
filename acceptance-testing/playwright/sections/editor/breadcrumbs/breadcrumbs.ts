import { BreadcrumbsLocators } from "./breadcrumbsLocators";
import { TestSection } from "../../testsection";

export class Breadcrumbs extends TestSection {

    private readonly locators = new BreadcrumbsLocators(this.context);

    async clickBreadcrumb(name: string): Promise<void> {
        await this.locators.getBreadcrumbWithName(name).click();
    }

    async clickFirstBreadcrumb(): Promise<void> {
        await this.locators.getFirstBreadcrumb().click();
    }

    async openContextMenu(): Promise<void> {
        await this.locators.contextMenuButton.click();
    }

    async clickItemContextMenu(itemTitle: string): Promise<void> {
        await this.sharedLocators.getContextMenuItem(itemTitle).click();
    }

    async assertTitle(itemTitle: string): Promise<void> {
        await this.locators.getBreadcrumbWithName(itemTitle).waitFor({ timeout: 10_000 });
    }

    async deleteCurrentItem(): Promise<void> {
        await this.openContextMenu();
        await this.clickItemContextMenu("Remove");
        await this.sharedLocators.getButtonInModal("Yes").click();
    }
}
