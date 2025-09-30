import { DocumentLocators } from "./documentlocators";
import { EditButton } from "./editButton";
import { MachineTranslationModal } from "./machineTranslationModal";
import { ReadConfirmation } from "./readConfirmation";
import { ReaderComments } from "./readerComments/readerComments";
import { ReaderFeedback } from "./feedback";
import { ReaderSharing } from "./readerSharing/readerSharing";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import ts from "@binders/client/lib/i18n/translations/en_US";

export type VideoStatus = "playing" | "paused" | "transcoding" | "error";

export class Document extends TestSection {

    private readonly locators = new DocumentLocators(this.context);

    get readerComments(): ReaderComments {
        return new ReaderComments(this.context);
    }

    get feedback(): ReaderFeedback {
        return new ReaderFeedback(this.context);
    }

    get readConfirmation(): ReadConfirmation {
        return new ReadConfirmation(this.context);
    }

    get machineTranslationModal(): MachineTranslationModal {
        return new MachineTranslationModal(this.context);
    }

    get readerSharing(): ReaderSharing {
        return new ReaderSharing(this.context);
    }

    async assertChunkDisclaimedContent(chunkNumber: number, expectedContent: string): Promise<void> {
        const el = this.locators.chunkText(chunkNumber - 1);
        await el.waitFor({ state: "visible" });
        const disclaimer = this.locators.chunkDisclaimer(chunkNumber - 1);
        await disclaimer.waitFor({ state: "visible" });
        await expect(disclaimer).toContainText(ts.DocManagement_MachineTranslationWarning, { timeout: 40_000 });
        await expect(el).toContainText(expectedContent, { timeout: 40_000 });
    }

    get editButton(): EditButton {
        return new EditButton(this.context);
    }

    async assertChunkContent(chunkNumber: number, expectedContent: string | RegExp): Promise<void> {
        const el = this.locators.chunkText(chunkNumber - 1);
        await el.waitFor({ state: "visible" });
        await expect(el).toHaveText(expectedContent, { timeout: 40_000 });
    }

    assertVisualWithSrc(chunkNumber: number, srcPart: string): Promise<void> {
        return this.locators.getNthVisualIncludingSrc(chunkNumber, srcPart).waitFor();
    }

    async clickUpButton(): Promise<void> {
        await this.locators.upButton.click()
    }

    async clickNextDocumentButton(): Promise<void> {
        await this.locators.nextDocumentButton.click()
    }

    async clickPrevDocumentButton(): Promise<void> {
        await this.locators.prevDocumentButton.click()
    }

    async expectChunkToBeActive(chunkIndex: number): Promise<void> {
        await expect(this.locators.activeChunkText(chunkIndex)).toBeVisible();
    }

    async expectChunkToBeVisible(chunkIndex: number): Promise<void> {
        await expect(this.locators.chunkText(chunkIndex)).toBeVisible();
    }

    /**
     * Returns status of the video playback
     * @argument chunk - index of the chunk (first chunk is 1)
     * @argument carrouselPosition - index of the video in the carrousel. If not provided, or negative, assume no carrousel.
     */
    async getVideoStatus(chunk: number, carrouselPosition = -1): Promise<VideoStatus> {
        if (await this.locators.videoStillTranscoding(chunk, carrouselPosition).count() > 0) {
            return "transcoding";
        }
        await this.locators.visual(chunk, carrouselPosition).waitFor();
        await this.page.waitForTimeout(1000);
        const screenShot1 = (await this.page.screenshot({ fullPage: true })).toString("base64");
        await this.page.waitForTimeout(500);
        const screenShot2 = (await this.page.screenshot({ fullPage: true })).toString("base64");
        if (screenShot1 !== screenShot2) {
            return "playing";
        }
        return "error";
    }

    async goToNextChunk(): Promise<void> {
        /**
         * An element handle points to a specific element in the DOM.
         * We create element handles to the currently active chunk, and the next chunk.
         * We then wait for the next chunk to contain the "active" class and the current one to lose it.
         */
        await this.locators.activeChunk.waitFor();
        await this.locators.nextChunk.waitFor();
        const activeChunkHandle = await this.locators.activeChunk.elementHandle();
        const nextChunkHandle = await this.locators.nextChunk.elementHandle();

        await this.locators.activeChunk.click();

        // This function is ran inside the e2e browser
        await this.page.waitForFunction(node => {
            return node.classList.contains("active");
        }, nextChunkHandle);
        await this.page.waitForFunction(node => {
            return !node.classList.contains("active");
        }, activeChunkHandle);

        // Elements targeted by elementHandles cannot be garbage collected until they are disposed.
        await activeChunkHandle.dispose();
        await nextChunkHandle.dispose();
    }

    async goToTop(): Promise<void> {
        await this.page.evaluate(() => {
            window.scrollTo(0, 0);
        });
    }

    async machineTranslateTo(languageLabelPart: string, languageCode: string): Promise<void> {
        await this.locators.collapsedToolbarLanguage.click();
        await this.locators.machineTranslationButton.click();
        await this.machineTranslationModal.selectLanguage(languageLabelPart);
        const info = getLanguageInfo(languageCode);
        await this.locators.getActiveLanguageLabelWithName(`${info.nativeName} *`).waitFor();
    }

    async goToNextVisualInCarrousel(chunkNumber: number): Promise<void> {
        await this.locators.carrouselNextVisual(chunkNumber).click();
    }

    async toggleChecklistInActiveChunk(expectedActiveChunk?: number): Promise<void> {
        await this.locators.activeChecklistWrapper.waitFor();
        const wrapperHandle = await this.locators.activeChecklistWrapper.elementHandle();
        const isChecked = await this.getCurrentChunkCheckboxState();
        await this.locators.activeChecklist.click();
        if (isChecked) {
            await this.page.waitForFunction(node => {
                return !node.classList.contains("checklistStatus--isPerformed");
            }, wrapperHandle);
        } else {
            await this.page.waitForFunction(node => {
                return node.classList.contains("checklistStatus--isPerformed");
            }, wrapperHandle);
        }
        await wrapperHandle.dispose();
        if (Number.isInteger(expectedActiveChunk)) {
            await this.waitForNthActiveChunk(expectedActiveChunk);
        }
    }

    async assertCheckboxInCurrentChunk() {
        await this.locators.activeChecklistWrapper.waitFor();
    }

    async assertNoCheckboxInCurrentChunk() {
        await expect(this.locators.activeChecklistWrapper).not.toBeVisible();
    }

    async getCurrentChunkCheckboxState() {
        await this.locators.activeChecklistWrapper.waitFor();
        const wrapperHandle = await this.locators.activeChecklistWrapper.elementHandle();

        return await wrapperHandle.evaluate(
            node => node.classList.contains("checklistStatus--isPerformed")
        );
    }

    async assertCurrentChunkCheckboxState(isChecked: boolean) {
        expect(await this.getCurrentChunkCheckboxState()).toBe(isChecked);
    }

    async waitForNthActiveChunk(n: number): Promise<void> {
        await this.locators.activeChunkText(n).waitFor();
    }

    async expandToolbar(): Promise<void> {
        await this.locators.toolbarExpandTrigger.click();
    }

    async waitForChunksCount(n: number): Promise<boolean> {
        await this.locators.activeChunk.waitFor();

        let chunksCount = -1;
        while (chunksCount !== n) {
            chunksCount = await this.locators.allChunks.count();
            await this.wait(200);
        }
        return true;
    }

    async waitForVideoPreloaded(videoId: string): Promise<void> {
        await expect(this.locators.getPreloadedInfoInput(videoId)).toHaveAttribute("value", "1");
    }

    async assertVisualNotMounted(chunk: number, carrouselPosition: number): Promise<void> {
        await expect(this.locators.visual(chunk, carrouselPosition)).not.toBeVisible();
    }

    async switchLanguage(languageCode: string): Promise<void> {
        await this.locators.collapsedToolbarLanguage.click();
        await this.locators.getLanguageButton(languageCode).click();
        const languageInfo = getLanguageInfo(languageCode);
        await this.locators.getSelectedLanguageLabel(languageInfo.nativeName).waitFor();
    }

    async showOwners(): Promise<void> {
        await this.locators.ownershipButton.click();
    }

    async assertOwner(login: string): Promise<void> {
        await expect(this.locators.ownersPopout).toContainText(login);
    }
}
