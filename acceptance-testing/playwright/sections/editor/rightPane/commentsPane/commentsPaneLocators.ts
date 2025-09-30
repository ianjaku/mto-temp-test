import { Locator } from "@playwright/test";
import { TestSectionLocators } from "../../testsectionlocators";

export class CommentsPaneLocators extends TestSectionLocators {

    addCommentButton = this.page.locator(".rightPane >> .new-thread-form >> .comment-textarea > .btn-send");
    commentsPaneButton = this.page.locator(".rightPane >> .comments-pane-item");
    deleteCommentConfirmationModalConfirmButton = this.page.locator(".modal-delete-comment >> .button:has-text(\"Delete comment\")");
    emptyCommentsView = this.page.locator(".rightPane >> .comment-threads-list >> .comments-empty-graphic");
    newThreadButton = this.page.locator(".rightPane >> .new-thread-btn");
    newThreadTextArea = this.page.locator(".rightPane >> .new-thread-form >> .comment-textarea > textarea");

    public activeCommentContextMenuItem(label: string): Locator {
        return this.page.locator(`.comment-context-menu-dropdown >> li:has-text("${label}")`);
    }

    public comment(threadIdx: number, commentIdx: number): Locator {
        return this.page
            .locator(".rightPane >> .comment-threads-list > .comment-thread")
            .nth(threadIdx)
            .locator(".comment-thread-comment")
            .nth(commentIdx);
    }

    public commentContextMenu(threadIdx: number, commentIdx: number): Locator {
        return this.comment(threadIdx, commentIdx)
            .locator(".comment-context-menu");
    }

    public commentText(threadIdx: number, commentIdx: number): Locator {
        return this.comment(threadIdx, commentIdx)
            .locator(".comment-body")
    }

    public commentsThread(idx: number): Locator {
        return this.page.locator(".rightPane >> .comment-threads-list > .comment-thread").nth(idx);
    }

    commentsTab(tabName: "reader" | "editor"): Locator {
        return this.page.getByTestId(`comments-pane-label-${tabName}`);
    }
}
