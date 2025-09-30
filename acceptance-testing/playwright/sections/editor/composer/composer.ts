import {
    getVisualIdsForBinder,
    waitForImageUploads,
    waitForVisualCompleteState
} from "../../../../shared/api/image";
import { ComposerLocators } from "./composerlocators";
import { DiffView } from "./diffView/diffView";
import { Document } from "../../reader/document/document";
import { LinkEditor } from "./linkEditor/linkEditor";
import { LinkToolbar } from "./linkToolbar/linkToolbar";
import { MediaPane } from "./mediaPane/mediaPane";
import { SharingModal } from "./sharingModal/sharingModal";
import { TestSection } from "../../testsection";
import { VisualSettings } from "./visualSettings/visualSettings";
import { error } from "@binders/client/lib/util/cli";
import { expect } from "@playwright/test";
import sleep from "@binders/binders-service-common/lib/util/sleep";
import ts from "@binders/client/lib/i18n/translations/en_US";
import { waitForTitleUpdateInBackend } from "../../../../shared/api/binder";

interface WaitForAutoSaveOptions {
    timeout: number;
    callback?: () => Promise<void>;
}

export class Composer extends TestSection {

    private readonly locators = new ComposerLocators(this.context);

    get diffView(): DiffView {
        return new DiffView(this.context);
    }

    get linkEditor(): LinkEditor {
        return new LinkEditor(this.context);
    }

    get linkToolbar(): LinkToolbar {
        return new LinkToolbar(this.context);
    }

    get sharingModal(): SharingModal {
        return new SharingModal(this.context);
    }

    get visualSettings(): VisualSettings {
        return new VisualSettings(this.context);
    }

    get mediaPane(): MediaPane {
        return new MediaPane(this.context);
    }

    async focusTitle(): Promise<void>{
        await this.locators.titleTextArea.click({ clickCount: 3 });
        try {
            await this.locators.activeTitleTextArea.waitFor({ timeout: 10000 });
        } catch (e) {
            // fails occasionally in the pipeline (textarea not ready?), retry once
            await this.locators.titleTextArea.click({ clickCount: 3 });
            await this.locators.activeTitleTextArea.waitFor({ timeout: 10000 });
        }
    }

    async fillTitle(text: string, waitForIt = true): Promise<void> {
        await this.focusTitle();
        await this.locators.titleTextArea.fill(text);
        await this.locators.getTitleTextAreaWithText(text).waitFor({ timeout: 10000 });
        if (waitForIt) {
            await waitForTitleUpdateInBackend(await this.getBinderId(), text);
        }
    }

    async fillSecondaryTitle(text: string): Promise<void> {
        await this.locators.secondaryTitleTextArea.click({ clickCount: 3 });
        await this.locators.secondaryTitleTextArea.fill(text);
    }

    async fillSecondaryChunk(chunkIndex: number, text: string): Promise<void> {
        await this.locators.secondaryChunkTextEditor(chunkIndex).click();
        await this.locators.secondaryChunkTextEditor(chunkIndex).fill(text);
    }

    /**
     * Sets the text of an existing chunk
     * Use fillNewChunk to create new chunks
     *
     * @param chunkIndex 0 = the first non-title chunk
     * @param text
     */
    async fillChunk(chunkIndex: number, text: string): Promise<void> {
        await this.locators.chunkTextEditor(chunkIndex).fill(text);
    }

    /**
     * Types into an existing chunk
     * Use fillChunk to replace the content
     *
     * @param chunkIndex 0 = the first non-title chunk
     * @param text
     */
    async typeIntoChunk(chunkIndex: number, text: string): Promise<void> {
        await this.locators.chunkTextEditor(chunkIndex).type(text);
    }

    async clickWordInChunk(chunkIndex: number, word: string): Promise<void> {
        await this.locators.elementInChunk(chunkIndex, `text=${word}`).click();
    }

    // Adds a new chunk with the given text at the bottom of the composer
    async fillNewChunk(text: string): Promise<void> {
        await this.locators.emptyChunk.click();
        await this.fillChunk(-1, text);
    }

    /**
     * Focuses the text editor of a given chunk
     *
     * @param chunkIndex 0 = the first non-title chunk
     */
    async focusChunk(chunkIndex: number): Promise<void> {
        await this.locators.chunkTextEditor(chunkIndex).focus();
    }

    /**
    * Highlights text within a chunk in the text editor.
    *
    * @param chunkIndex 0 = the first non-title chunk
    * @param start Start index of the text to highlight
    * @param end End index of the text to highlight
    */
    async highlightChunkText(chunkIndex: number, start: number, end: number): Promise<void> {
        const editor = this.locators.chunkTextEditor(chunkIndex);
        await editor.focus();

        await editor.evaluate((element: HTMLElement, { start, end }: { start: number, end: number }) => {
            const range = document.createRange();
            const selection = window.getSelection();

            let currentOffset = 0;

            /**
            * Function to find the correct node and offset within that node
            */
            function findNodeAndOffset(node: ChildNode, targetOffset: number) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const nodeLength = node.textContent?.length || 0;
                    if (currentOffset + nodeLength >= targetOffset) {
                        return { node, offset: targetOffset - currentOffset };
                    }
                    currentOffset += nodeLength;
                } else {
                    for (const childNode of Array.from(node.childNodes)) {
                        const result = findNodeAndOffset(childNode, targetOffset);
                        if (result) return result;
                    }
                }
                return null;
            }

            const startPos = findNodeAndOffset(element, start);
            const endPos = findNodeAndOffset(element, end);
            if (startPos && endPos) {
                range.setStart(startPos.node, startPos.offset);
                range.setEnd(endPos.node, endPos.offset);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, { start, end });
    }

    async clickTextEditorToolBarButton(btnLabel: string): Promise<void> {
        await this.locators.textEditorToolBarButton(btnLabel).click();
    }

    async assertTextEditorToolBarVisible(): Promise<void> {
        await expect(this.locators.textEditorToolBar()).toBeVisible();
    }

    async assertTextEditorToolBarButtonActive(btnLabel: string): Promise<void> {
        await expect(this.locators.textEditorToolBarButton(btnLabel)).toHaveClass(/.*\sactive$/);
    }

    async assertChunkContainsHTML(chunkIndex: number, htmlStringOrRegExp: string | RegExp): Promise<void> {
        const editor = this.locators.chunkTextEditor(chunkIndex);
        const editorContent = await editor.innerHTML();
        expect(editorContent).toMatch(htmlStringOrRegExp);
    }

    async assertChunkContainsRegex(chunkIndex: number, regex: RegExp, options = { not: false }): Promise<void> {
        const editor = this.locators.chunkTextEditor(chunkIndex);
        const editorContent = await editor.innerHTML();
        if (options.not) {
            expect(editorContent).not.toMatch(regex);
            return;
        }
        expect(editorContent).toMatch(regex);
    }

    /**
     * Upload an image/video to a chunk
     *
     * @param chunkIndex 1 = the first non-title chunk, 2 = the second, ...
     * @param fileName It's easiest to use realpathSync, ex: realpathSync("files/media/landscape.jpg")
     * @param assertedBinderVisualsCount The number of visuals that should be in the binder after this upload.
     *                                   If passed, will wait for the visuals to be in the binder.
     * @param waitForCompletedVisuals Will wait for the visuals to finish processing (Mostly useful for videos)
     */
    async uploadFileToChunk(
        chunkIndex: number,
        fileName: string,
        assertedBinderVisualsCount = 0,
        waitForCompletedVisuals = false,
    ): Promise<string[]> {
        const fileChooserPromise = this.page.waitForEvent("filechooser");

        // If there are already visuals in the chunk, we have to click the little "+" button
        if (await this.locators.visualsInChunk(chunkIndex).count() > 0) {
            await this.locators.thumbnailOuterWrapper(chunkIndex).nth(0).hover({ force: true });
            // The "+" icon is triggered by a mouseEnter event, so we have to move the mouse to it
            const el = await this.locators.thumbnailOuterWrapper(chunkIndex).nth(0).elementHandle()
            const boundingBox = await el.boundingBox();
            await this.page.mouse.move(0, 0);
            await this.page.mouse.move(boundingBox.x + (boundingBox.width / 2), boundingBox.y + (boundingBox.height / 2));
            await this.locators.addVisualToChunkButton.click();
        } else {
            await this.locators.chunkUploadButton(chunkIndex).click();
        }


        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(fileName);
        let visualIds: string[] | undefined;
        if (assertedBinderVisualsCount > 0) {
            const binderId = await this.getBinderId();
            visualIds = await waitForImageUploads(180_000, binderId, assertedBinderVisualsCount);
        }
        if (waitForCompletedVisuals) {
            // eslint-disable-next-line no-console
            console.log("Waiting for the visuals to complete")
            const binderId = await this.getBinderId();
            await sleep(20_000);
            await waitForVisualCompleteState(600_000, binderId);
        }
        if (visualIds == null) {
            const binderId = await this.getBinderId();
            visualIds = await getVisualIdsForBinder(binderId);
        }
        return visualIds;
    }

    // First non-title chunk is 0
    async toggleChunkCheckable(chunkIndex: number): Promise<void> {
        await this.openContextMenu(chunkIndex);
        await this.locators.toggleChecklistCheckbox().click();
        await this.locators.closeChunkContextMenu().click();
    }

    async optimizeDocument(): Promise<void> {
        await this.locators.aiOptimizeBinderButton.click();
    }

    async applyAiFormatting(chunkIndex: number): Promise<void> {
        await this.openContextMenu(chunkIndex);
        await this.locators.clickApplyAiFormatting().click();
    }

    async undoAiFormatting(chunkIndex: number): Promise<void> {
        await this.openContextMenu(chunkIndex);
        await this.locators.clickUndoAiFormatting().click();
    }

    async assertNoContextMenu(chunkIndex: number): Promise<void> {
        await expect(this.page.locator(".chunk-extras .chunk-contextmenu").nth(chunkIndex)).toHaveCount(0);
    }

    async openContextMenu(chunkIndex: number): Promise<void> {
        await this.locators.openChunkContextMenu(chunkIndex).click();
    }

    async closeContextMenu(): Promise<void> {
        await this.locators.closeChunkContextMenu().click();
    }

    async publish(awaitPublished = false): Promise<void> {
        await this.locators.enabledPublishButton.click();
        await this.locators.confirmPublishButton.click();
        await this.locators.successfulPublishModalTitle.waitFor();
        await this.locators.publishModalCloseButton.click();
        if (awaitPublished) {
            await this.waitForUpToDateMsg();
        }
    }

    async expectPublishButtonDisabled(): Promise<void> {
        const isDisabled = await this.locators.publishButton
            .evaluate(button => button.classList.contains("button--disabled"));
        if (!isDisabled) {
            throw new Error("Publish button enabled");
        }
    }

    async publishSecondary(waitForPublish = false): Promise<void> {
        await this.locators.enabledPublishButtonSecondary.click();
        await this.locators.confirmPublishButton.click();
        await this.locators.successfulPublishModalTitle.waitFor();
        await this.locators.publishModalCloseButton.click();
        if (waitForPublish) {
            await this.waitForUpToDateMsg(true);
        }
    }

    async openPreview(): Promise<Document> {
        const newTabPromise = this.page.waitForEvent("popup");
        await this.locators.previewButton.click();
        const newTab = await newTabPromise;
        const testContext = {
            page: newTab,
            readerUrl: this.context.readerUrl,
            editorUrl: this.context.editorUrl
        }
        return new Document(testContext);
    }

    async openContextMenuChecklistProgress(): Promise<void> {
        await this.locators.contextMenu.click();
        try {
            await this.locators.contextMenuPopover.waitFor({ timeout: 10000 });
            await this.locators.contextMenuChecklistProgress.click();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            // fails occasionally in the pipeline (context menu trigger button not ready?), retry once
            await this.locators.contextMenu.click();
            await this.locators.contextMenuPopover.waitFor({ timeout: 10000 });
            await this.locators.contextMenuChecklistProgress.click();
        }
    }

    async getBinderId(): Promise<string> {
        const url = this.page.url();
        const withoutQuery = url.split("?").shift();
        return withoutQuery.split("/").pop();
    }

    async waitForAutoSave(options: Partial<WaitForAutoSaveOptions> = {}): Promise<void> {
        const timeout = options.timeout || 30_000;
        try {
            if (options.callback) {
                await options.callback();
            }
            await this.page.waitForResponse(
                /.*binders\/v3\/binders/,
                { timeout: timeout }
            );
        } catch (exc) {
            error("Failed to wait for autosave", exc);
        }
    }

    async waitForUpToDateMsg(forSecondary = false): Promise<void> {
        if (forSecondary) {
            await this.locators.upToDateMsgSecondary.waitFor();
        } else {
            await this.locators.upToDateMsg.waitFor();
        }
    }

    /**
     * @param chunkIndex The index of the chunk that should be approved. Index 0 is the title chunk, 1 is the second chunk, ..
     */
    async approveChunk(chunkIndex: number): Promise<void> {
        await this.locators.chunkContextMenu(chunkIndex).click();
        await this.locators.chunkContextApproveOption.click();
    }

    async approveAll(): Promise<void> {
        await this.locators.approveAllButton.click();
    }

    async expectApproveAllButtonNotAvailable(): Promise<void> {
        await this.locators.approveAllButton.waitFor({
            state: "hidden",
            timeout: 10_000
        });
    }

    /**
     * @param chunkIndex The index of the chunk that should be approved. Index 0 is the title chunk, 1 is the second chunk, ..
     */
    async rejectChunk(chunkIndex: number): Promise<void> {
        await this.locators.chunkContextMenu(chunkIndex).click();
        await this.locators.chunkContextRejectOption.click();
    }

    /**
     * @param chunkIndex The index of the chunk that should be approved. Index 0 is the title chunk, 1 is the second chunk, ..
     */
    async clearChunkApproval(chunkIndex: number): Promise<void> {
        await this.locators.chunkContextMenu(chunkIndex).click();
        await this.locators.chunkContextClearApprovalOption.click();
    }

    async expectRequestToPublishButtonDisabled(): Promise<void> {
        await expect(this.locators.requestToPublishButton).toHaveClass(/button--disabled/)
    }

    async clickRequestToPublishButton(): Promise<void> {
        await expect(this.locators.requestToPublishButton).not.toHaveClass(/button--disabled/)
        await this.locators.requestToPublishButton.click();
    }

    async openMediaPane(): Promise<void> {
        await this.locators.getRightPaneButton("media").click();
    }

    async openSettingsForChunkVisual(chunkIndex: number, visualIndex = 0): Promise<void> {
        await this.locators.visualsInChunk(chunkIndex).nth(visualIndex).dblclick();
    }

    // Requires a secondary language to be open
    async translateChunk(chunkIndex: number): Promise<void> {
        await this.locators.chunkTextEditor(chunkIndex).click();
        await this.locators.translateChunkButtonDisabled.waitFor({ state: "hidden" });
        await this.locators.translateChunkButton.click();
    }

    async ctrlShiftZ(): Promise<void> {
        await this.page.keyboard.press("Control+Shift+z")
    }

    async ctrlZ(): Promise<void> {
        await this.page.keyboard.press("Control+z")
    }

    async expectChunkValue(chunkIndex: number, value: string, options?: { secondary?: boolean, timeoutMs?: number }): Promise<void> {
        if (options?.secondary) {
            await expect(this.locators.secondaryChunkTextEditor(chunkIndex)).toHaveText(value, { timeout: options?.timeoutMs });
        } else {
            await expect(this.locators.chunkTextEditor(chunkIndex)).toHaveText(value, { timeout: options?.timeoutMs });
        }
    }

    async expectChunkContextMenuItem(chunkIndex: number, title: string): Promise<void> {
        await expect(this.locators.contextMenuItem(chunkIndex, title)).toBeVisible();
    }

    async expectNoStatus(): Promise<void> {
        await expect(this.locators.statusMsg).toBeEmpty();
    }

    async expectMissingApprovalsStatus(): Promise<void> {
        await expect(this.locators.statusMsg).toContainText(ts.Edit_PublishFailNoApprovals);
    }

    async expectCantApproveEmptyChunksStatus(): Promise<void> {
        await expect(this.locators.statusMsg).toContainText(ts.Edit_ChunkApproveAllEmptyDetected);
    }

    async deleteActiveChunk(): Promise<void> {
        await this.locators.deleteActiveChunkButton.click();
    }

    async waitForChunkApprovalState(chunkIdx: number, state: "approved" | "rejected" | "unknown"): Promise<void> {
        await this.locators.chunkEditor.nth(chunkIdx).locator(`.approval-box.${state}`).waitFor();
    }

    async waitForChunksCount(n: number, timeoutMs = 2000): Promise<boolean> {
        let chunksCount = -1;
        const startedAt = Date.now()
        while (chunksCount !== n) {
            chunksCount = await this.locators.chunkEditor.count();
            await this.wait(100);
            if (Date.now() - startedAt > timeoutMs) throw new Error(`Timed out waiting for ${n} chunks (got ${chunksCount} instead)`);
        }
        return true;
    }

    async closeSecondaryLanguage(): Promise<void> {
        await this.locators.secondaryLanguageCloseButton.click();
    }

    async expectTitleNotEditable(): Promise<void> {
        const isDisabled = await this.locators.wholeTitleChunk
            .evaluate(chunk => chunk.classList.contains("chunkNEW-disabled"));
        if (!isDisabled) {
            throw new Error("Title is editable");
        }
    }

    async expectEmptyChunkNotEditable(): Promise<void> {
        const isDisabled = await this.locators.wholeEmptyChunk
            .evaluate(chunk => chunk.classList.contains("isDisabled"));
        if (!isDisabled) {
            throw new Error("Empty chunk is editable");
        }
    }

    /**
     * Ensures that the title, chunks and new chunk are not editable
     */
    async expectLanguageNotEditable(): Promise<void> {
        await this.expectTitleNotEditable();
        await this.expectEmptyChunkNotEditable();
        const chunks = await this.locators.allChunks.all();
        for (const [i, chunk] of chunks.entries()) {
            const isDisabled = await chunk.evaluate(chunk => chunk.classList.contains("chunkNEW-disabled"));
            if (!isDisabled) {
                throw new Error(`Chunk ${i} is enabled`);
            }
        }
    }

    async switchToLanguage(language: string): Promise<void> {
        await this.locators.languageSwitcherDropdown.click();
        await this.locators.getLanguageSwitcherOption(language).click();
    }

    async mergeChunkIntoAbove(chunk: number, totalChunks?: number): Promise<void> {
        await this.focusChunk(chunk);
        await this.locators.mergeChunksButton.click();
        if (totalChunks) {
            // Emtpy chunk is added to the end of the list, so +1
            await this.waitForChunksCount(totalChunks + 1, 20_000);
        }
    }

    async expectChunksMergeNotAllowed(): Promise<void> {
        await this.locators.chunkTextEditor(1).click();  // The chunk number cannot be first (0)
        const numberOfMergeButtons = await this.locators.mergeChunksButton.count();
        if (numberOfMergeButtons > 0) {
            throw new Error("Chunks button is visible");
        }
    }

    async assertShareButtonEnabledState(expectEnabled: boolean): Promise<void> {
        if (expectEnabled) {
            await expect(this.locators.shareButton).not.toHaveClass(/.*button--disabled.*/);
        } else {
            await expect(this.locators.shareButton).toHaveClass(/.*button--disabled.*/);
        }
    }

    async clickShareButton(): Promise<void> {
        await this.locators.shareButton.click();
    }

    async clickOwnershipButton(): Promise<void> {
        await this.locators.ownershipButton.click();
    }

    async assertFirstChunkIsEmpty(): Promise<void> {
        const chunks = this.page.locator(".chunks-area .chunk-dragwrapper");
        await expect(chunks).toHaveCount(1);
        const text = await chunks.nth(0).innerText();
        expect(text.trim()).toMatch("Enter some text");
    }

}
