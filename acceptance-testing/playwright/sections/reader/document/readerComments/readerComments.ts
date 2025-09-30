import { ReaderCommentsLocators } from "./readerCommentsLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";


export class ReaderComments extends TestSection {

    private readonly locators = new ReaderCommentsLocators(this.context);

    async openSidebar(): Promise<void> {
        await this.locators.commentsSidebarOpenButton.click();
    }

    async expectCommentsSidebarButton(toExist = true): Promise<void> {
        if (toExist) {
            await expect(this.locators.commentsSidebarOpenButton).toBeVisible();
        } else {
            await expect(this.locators.commentsSidebarOpenButton).toBeHidden();
        }
    }

    async closeSidebar(): Promise<void> {
        await this.locators.commentsSidebarCloseButton.click();
    }

    async writeComment(text: string): Promise<void> {
        await this.locators.writeCommentTextarea.type(text);
    }

    async submitComment(): Promise<void> {
        await this.locators.submitCommentButton.click();
    }

    async selectCommentByContent(text: string): Promise<void> {
        await this.locators.commentByContent(text).click();
    }

    async expectActiveGroupCommentBody(indexInList: number, body: string): Promise<void> {
        await expect(this.locators.activeGroupCommentBody(indexInList)).toHaveText(body);
    }

    async expectCommentBody(groupIndex: number, indexInList: number, body: string): Promise<void> {
        await expect(this.locators.commentBody(groupIndex, indexInList)).toHaveText(body);
    }

    async waitForCommentToBeRemoved(commentText: string, maxWaitInMs: number): Promise<void> {
        const sleepIntervalInMs = 100;
        for (let i = 0; i <= maxWaitInMs / sleepIntervalInMs; i++) {
            const currentNumberOfComments = await this.locators.commentByContent(commentText).count()
            if (currentNumberOfComments === 0) {
                return;
            }
            await this.wait(100);
        }
        throw new Error(`Comment with text "${commentText}" was not removed after ${maxWaitInMs} ms`);
    }

    async expectEditedLabel(indexInList: number): Promise<void> {
        await expect(this.locators.nthComment(indexInList)).toContainText("edited");
    }

    async expectSidebarVisible(): Promise<void> {
        await expect(this.locators.sidebar).toBeVisible();
    }

    async expectWriteCommentTextareaValue(value: string): Promise<void> {
        if (value == null || value.length === 0) {
            await expect(this.locators.writeCommentTextarea).toBeEmpty();
        } else {
            await expect(this.locators.writeCommentTextarea).toHaveValue(value);
        }
    }

    async stageAttachment(fileName: string): Promise<void> {
        await this.locators.attachmentFileInput.setInputFiles(fileName);
    }

    async expectLoadedCommentAttachment(groupIndex: number, indexInList: number, options = { waitForUploadsToFinish: true }): Promise<void> {
        if (options?.waitForUploadsToFinish) {
            await this.locators.getUploadingThumbnailWrapper().waitFor({ state: "detached" });
        }
        await expect(this.locators.commentAttachmentImg(groupIndex, indexInList)).toHaveJSProperty("complete", true);
        await expect(this.locators.commentAttachmentImg(groupIndex, indexInList)).not.toHaveJSProperty("naturalWidth", 0);
    }

    async openEditMode(indexInList: number): Promise<void> {
        await this.locators.commentsSidebarCloseButton.hover();
        await this.locators.nthComment(indexInList).hover();
        await this.locators.nthCommentDate(indexInList).hover();
        await this.locators.commentContextMenuTrigger(indexInList).click();
        await this.sharedLocators.getContextMenuItem("Edit").click();
    }

    async saveEdits(indexInList: number): Promise<void> {
        await this.locators.commentSaveButton(indexInList).click();
    }

    async editComment(indexInList: number, text: string): Promise<void> {
        await this.locators.editCommentTextarea(indexInList).press("Control+a");
        await this.locators.editCommentTextarea(indexInList).type(text);
    }

    async stageExtraAttachment(indexInList: number, fileName: string): Promise<void> {
        await this.locators.editCommentAttachmentFileInput(indexInList).setInputFiles(fileName);
    }

    async removeAttachment(indexInList: number, attachmentIndex: number): Promise<void> {
        await this.locators.nthAttachmentDeleteButton(indexInList, attachmentIndex).click();
    }

    async deleteChunkComment(commentText: string): Promise<void> {
        await this.triggerCommentDelete(commentText);
        await this.confirmCommentDelete();
        await this.ensureModalIsClosed();
    }

    private async triggerCommentDelete(commentText: string): Promise<void> {
        await this.locators.commentByContent(commentText).hover();
        await this.locators.selectedCommentMenuButton(commentText).click();
        await this.sharedLocators.getContextMenuItem("Delete").click();
    }

    private async confirmCommentDelete(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Delete comment").click();
    }

    private async ensureModalIsClosed(): Promise<void> {
        await expect(this.sharedLocators.getModalTitle()).toBeHidden({ timeout: 3000 });
    }

    async expectSidebarChunkOverlap(chunkIndex: number, expectOverlap: boolean): Promise<void> {
        const paragraph = await this.locators.chunkTextParagraph(chunkIndex);
        const { x: pX, width: pW } = await paragraph.boundingBox();
        const sidebar = await this.page.locator(".commentsSidebar");
        const { x: sbX } = await sidebar.boundingBox();
        await expect(pX + pW > sbX).toBe(expectOverlap);
    }
}
