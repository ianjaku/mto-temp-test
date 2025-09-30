import { Page, expect } from "@playwright/test";
import { ReaderSharingLocators } from "./readerSharingLocators";
import { TestSection } from "../../../testsection";
import { getClipboardContent } from "../../../../helpers/clipboard";

export class ReaderSharing extends TestSection {

    private readonly locators = new ReaderSharingLocators(this.context);

    async openModal(): Promise<void> {
        await this.locators.readerSharingTriggerButton.click();
        await expect(this.locators.readerSharingModal).toBeVisible();
    }

    async closeModal(): Promise<void> {
        await this.locators.closeButton.click();
    }

    async copyLink(page: Page, expectedSemanticId: string, maxTries = 1): Promise<string> {
        for (let i = 1; i <= maxTries; i++) {
            try {
                await this.locators.copyLinkButton.click();
                const clipboardContent = await getClipboardContent(page);
                expect(clipboardContent).toContain(expectedSemanticId);
                return clipboardContent;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log(`(Try #${i}) Encountered error while waiting to copy link`, e);
                await this.page.waitForTimeout(500);
            }
        }
        throw new Error("Failed to copy the semantic link");
    }

    async assertQrCode(): Promise<void> {
        const canvasEl = this.locators.qrCodeCanvas;
        const isQrLoaded = await canvasEl.evaluate((canvas: HTMLCanvasElement) => {
            const context = canvas.getContext("2d");
            const data = context.getImageData(0, 0, 100, 100).data;
            return data.some((value) => value !== 0);
        });
        expect(isQrLoaded).toBeTruthy();
    }

    async assertAccessNote(state: "restricted" | "public"): Promise<void> {
        const msg = state === "restricted" ?
            "This document has restricted access" :
            "Anyone with a link can view this document";
        await expect(this.locators.readerSharingModal).toContainText(msg);
    }
}
