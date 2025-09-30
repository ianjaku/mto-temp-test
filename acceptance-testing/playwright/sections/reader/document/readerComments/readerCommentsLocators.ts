import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../../editor/testsectionlocators";

export class ReaderCommentsLocators extends TestSectionLocators {

    sidebar = this.page.locator(".commentsSidebar");
    commentsSidebarOpenButton = this.page.locator(".material-icons >> text=comment");
    commentsSidebarCloseButton = this.page.locator(".commentsSidebar-closeButton");

    writeCommentTextarea = this.page.locator(".commentInput-input");
    submitCommentButton = this.page.locator("#readerComments-submitComment");

    attachmentFileInput= this.page.locator(".commentInput >> input[type=file]")

    comments(): Locator {
        return this.page.locator(".commentsSidebar .comment-item");
    }

    commentByContent(text: string): Locator {
        return this.comments().filter({ hasText: text });
    }

    activeGroupCommentBody(indexInGroup: number): Locator {
        return this.page.locator(`.commentsSidebar .commentsGroup--selected .comment-item:nth-child(${indexInGroup + 1}) .comment-body`);
    }

    commentBody(groupIndex: number, indexInGroup: number): Locator {
        return this.page.locator(`.commentsSidebar .commentsGroup:nth-child(${groupIndex + 1}) .comment-item:nth-child(${indexInGroup + 1}) .comment-body span:not(.comment-edited-label)`);
    }

    commentAttachmentImg(groupIndex: number, indexInGroup: number): Locator {
        return this.page.locator(`.commentsSidebar .commentsGroup:nth-child(${groupIndex + 1}) .comment-item:nth-child(${indexInGroup + 1}) .comment-attachments .thumbnail-wrapper img`);
    }

    nthComment(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1})`);
    }

    nthCommentDate(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1}) .comment-item-content-top-left`);
    }

    commentContextMenuTrigger(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1}) .comment-menu button`);
    }

    selectedCommentMenuButton(text: string): Locator {
        return this.comments().filter({ hasText: text }).locator(".comment-menu button");
    }

    editCommentTextarea(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1}) textarea.commentEdit-input`);
    }

    commentSaveButton(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1}) .commentEdit-actions-buttons >> text=Save`);
    }

    editCommentAttachmentFileInput(indexInList: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${indexInList + 1}) >> input[type=file]`);
    }

    nthAttachmentDeleteButton(commentIndex: number, attachmentIndex: number): Locator {
        return this.page.locator(`.commentsList .comment-item:nth-child(${commentIndex + 1}) .attachmentsList .attachmentsList-thumb:nth-child(${attachmentIndex + 1}) .thumbnail-outer-wrapper-delete-action`);
    }

    getUploadingThumbnailWrapper(): Locator {
        return this.page.locator(".thumbnail-outer-wrapper-uploading-icon");
    }

    chunkTextParagraph(index: number): Locator {
        return this.page.locator(`.text-module .chunk:nth-child(${index + 1}) .chunk-html p`)
    }
}
