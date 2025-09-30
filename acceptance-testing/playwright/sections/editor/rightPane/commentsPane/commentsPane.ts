import { CommentsPaneLocators } from "./commentsPaneLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";

export class CommentsPane extends TestSection {

    private locators = new CommentsPaneLocators(this.context);

    async addNewComment(commentText: string): Promise<void> {
        await this.locators.newThreadTextArea.fill(commentText);
        await this.locators.addCommentButton.click();
    }

    async assertCommentText(threadIdx: number, commentIdx: number, commentText: string): Promise<void> {
        await expect(this.locators.commentText(threadIdx, commentIdx)).toHaveText(commentText);
    }

    async assertNoComments(): Promise<void> {
        await expect(this.locators.emptyCommentsView).toContainText("This chunk does not have any comments.");
    }

    async clickNewThread(): Promise<void> {
        await this.locators.newThreadButton.click();
    }

    async deleteCommentByActiveContextMenu(): Promise<void> {
        await this.locators.activeCommentContextMenuItem("Delete comment").click();
        await this.locators.deleteCommentConfirmationModalConfirmButton.click();
    }

    async hoverComment(threadIdx: number, commentIdx: number): Promise<void> {
        await this.locators.comment(threadIdx, commentIdx).hover();
    }

    async openPane(): Promise<void> {
        await this.locators.commentsPaneButton.click();
    }

    async closePane(): Promise<void> {
        await this.locators.commentsPaneButton.click();
    }

    async switchToCommentsTab(tabName: "reader" | "editor"): Promise<void> {
        await this.locators.commentsTab(tabName).click();
    }

    async toggleCommentContextMenu(threadIdx: number, commentIdx: number): Promise<void> {
        await this.locators.commentContextMenu(threadIdx, commentIdx).click();
    }

}
