import { Download } from "playwright-core";
import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class TopBar extends TestSection {

    private readonly locators = new TopBarLocators(this.context);

    public async logOut(): Promise<void> {
        await this.locators.logoutBtn.click();
    }

    public async goToEditor(): Promise<string> {
        const [newTab] = await Promise.all([
            this.page.waitForEvent("popup"),
            this.locators.linkToEditor.click()
        ]);
        return newTab.url();
    }

    public async expectNoLinkToEditor(): Promise<void> {
        await this.locators.linkToEditor.waitFor({ state: "hidden" });
    }

    public async exportPdf(): Promise<Download> {
        await this.page.locator(".toolbarButtons-button:has-text(\"file_download\")").click();
        return this.page.waitForEvent("download");
    }

    public async search(text: string): Promise<void> {
        await this.locators.searchInput.fill(text);
        await this.locators.searchInput.press("Enter");
    }
}

export class TopBarLocators extends TestSectionLocators {
    searchInput = this.page.getByTestId("search-input").nth(0);
    logoutBtn = this.page.locator("[title='Logout'] >> svg");
    linkToEditor = this.page.locator("[title='To editor'] >> svg");
}
