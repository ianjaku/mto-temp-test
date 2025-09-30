import { Page, expect } from "@playwright/test";
import { TestSection } from "../../testsection";
import { getClipboardContent } from "../../../helpers/clipboard";

export class Shared extends TestSection {

    async clickButtonInModal(text: string, options = { modalHasText: undefined }): Promise<void> {
        await this.sharedLocators.getButtonInModal(text, {
            modalHasText: options.modalHasText,
            waitForEnabled: true,
            isUnhoverable: false,
        }).click();
    }

    async expectRibbon(text: string): Promise<void> {
        await this.sharedLocators.getRibbon(text).waitFor({ state: "visible" });
    }

    async expectNoRibbon(text: string): Promise<void> {
        await this.sharedLocators.getRibbon(text).waitFor({ state: "hidden" });
    }

    async clickButtonInRibbon(text: string): Promise<void> {
        await this.sharedLocators.getRibbonButton(text).click();
    }

    async pressButton(key: string): Promise<void> {
        await this.page.keyboard.press(key);
    }

    async expectClipboardContent(page: Page, contentRegex: RegExp): Promise<void> {
        const clipboardContent = await getClipboardContent(page);
        expect(clipboardContent).toMatch(contentRegex);
    }

}
