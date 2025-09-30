import { SharePaneLocators } from "./sharePaneLocators";
import { TestSection } from "../../../testsection";

export class SharePane extends TestSection {

    private locators = new SharePaneLocators(this.context);

    async togglePane(): Promise<void> {
        await this.locators.openPaneButton.click();
    }

    async addSemanticLink(link: string, languageCode: string): Promise<void> {
        await this.locators.getSemanticLinkContextForLanguageCode(languageCode).click();
        await this.locators.addSemanticLinkContextOption.click();
        await this.locators.getNewSemanticLinkInput(languageCode).type(link);
        await this.locators.semanticLinkManager.click();
    }

    // Similar to addSemanticLink, but there are no semantic links yet, so the new input field is always shown
    async setSemanticLink(link: string, languageCode: string): Promise<void> {
        // @TODO FLAKEY: Find a better solution for this
        // We need to wait for a bit or the input field won't be filled out correctly
        // (first characters were missing ins some test runs)
        await this.wait(200);
        await this.locators.getNewSemanticLinkInput(languageCode).type(link);
        await this.locators.semanticLinkManager.click();
    }
}