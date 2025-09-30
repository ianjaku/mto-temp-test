import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class ComposerLocators extends TestSectionLocators {

    activeTitleTextArea = this.page.locator(".chunkNEW-text.isActive textarea");
    addVisualToChunkButton = this.page.locator(".thumbnail-outer-wrapper-add-action"); // The little "+" when hovering over a visual
    aiOptimizeBinderButton = this.page.locator(".ai-optimize-binder-btn");
    allChunks = this.page.locator(".chunkNEW:not(.binderlanguage-title):not(.chunkNEW--emptyChunk)");
    approveAllButton = this.page.locator("#approveAllButton");
    chunkContextApproveOption = this.page.locator(".contextMenu-item-option:text(\"Approve\")");
    chunkContextClearApprovalOption = this.page.locator(".contextMenu-item-option:text(\"Clear\")");
    chunkContextRejectOption = this.page.locator(".contextMenu-item-option:text(\"Reject\")");
    chunkEditor = this.page.locator(".chunkNEW-text");
    confirmPublishButton = this.page.locator(".publish-confirmation div.button:text(\"Publish\")");
    contextMenu = this.page.locator(".breadcrumbs-item--last .MuiButtonBase-root");
    contextMenuChecklistProgress = this.page.locator(".MuiButtonBase-root >> text=Checklist progress");
    contextMenuPopover = this.page.locator(".context-menu-popover-paper");
    emptyChunk = this.page.locator(".chunktext-wrapper .empty-chunk");
    enabledPublishButton = this.page.locator(".binderLanguageControls >> nth=0 >> #publishbtn:not(.button--disabled)");
    enabledPublishButtonSecondary = this.page.locator(".binderLanguageControls >> nth=1 >> #publishbtn:not(.button--disabled)");
    deleteActiveChunkButton = this.page.locator("button.button-delete-chunk");
    languageSwitcherDropdown = this.page.locator(".language-selectors-selector-dropdown");
    mergeChunksButton = this.page.locator(".chunk-controls >> .button-merge-chunks");
    ownershipButton = this.page.locator(".composer-owners-triggerBtn");
    publishButton = this.page.locator(".binderLanguageControls >> nth=0 >> #publishbtn");
    publishModalCloseButton = this.page.locator(".publish-confirmation-modal >> .modal-closeBtn");
    previewButton = this.page.locator(".binderLanguageControls >> nth=0 >> text=Preview");
    requestToPublishButton = this.page.locator("#requestToPublishButton");
    secondaryLanguageCloseButton = this.page.locator(".language-selectors-selector-close");
    secondaryTitleTextArea = this.page.locator(".e2eSecondary-text textarea");
    shareButton = this.page.getByTestId("composer-share-button");
    statusMsg = this.page.locator(".binderLanguageControls-status");
    successfulPublishModalTitle = this.page.locator(".publish-confirmation-complete-title:text(\"Successfully published!\")");
    titleTextArea = this.page.locator(".chunkNEW-text textarea");
    translateChunkButton = this.page.locator(".button-translate-chunk");
    translateChunkButtonDisabled = this.page.locator(".button-translate-chunk.side-chunk-button--disabled");
    upToDateMsg = this.page.locator(".binderLanguageControls-status >> nth=0 >> text=Up to date");
    upToDateMsgSecondary = this.page.locator(".binderLanguageControls-status >> nth=1 >> text=Up to date");
    wholeEmptyChunk = this.page.locator(".chunkNEW--emptyChunk >> .chunk.empty-chunk");
    wholeTitleChunk = this.page.locator(".binderlanguage-title");

    saveConfirmation(howLongAgo: string): Locator {
        return this.page.locator(`text=/Auto-saved ${howLongAgo}/`);
    }

    openChunkContextMenu(index: number): Locator {
        return this.page.locator(".chunk-extras .chunk-contextmenu").nth(index);
    }

    closeChunkContextMenu(): Locator {
        return this.page.locator(".MuiPopover-root div").nth(0);
    }

    // Requires the context menu of a chunk to already be open (with openChunkContextMenu)
    toggleChecklistCheckbox(): Locator {
        return this.page.locator(".MuiPaper-root .MuiButtonBase-root :text(\"Checkable\")").nth(0)
    }

    clickApplyAiFormatting(): Locator {
        return this.page.locator(".MuiPaper-root .MuiButtonBase-root :text(\"Apply AI formatting\")").nth(0)
    }

    clickUndoAiFormatting(): Locator {
        return this.page.locator(".MuiPaper-root .MuiButtonBase-root :text(\"Undo AI formatting\")").nth(0)
    }

    contextMenuItem(chunkIdx: number, title: string): Locator {
        return this.page.locator(`.MuiPaper-root .MuiButtonBase-root .contextMenu-item-option :text("${title}")`).nth(0);
    }

    chunkTextEditor(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-text [contenteditable=\"true\"]")
            .nth(chunkIndex);
    }

    elementInChunk(chunkIndex: number, selectorOrLocator: string | Locator): Locator {
        return this.page
            .locator(".chunkNEW-text [contenteditable=\"true\"]")
            .nth(chunkIndex)
            .locator(selectorOrLocator);
    }

    textEditorToolBar(): Locator {
        return this.page.locator(".text-editor-tool-bar-main");
    }

    textEditorToolBarButton(btnLabel: string): Locator {
        return this.textEditorToolBar().locator(`[aria-label="${btnLabel}"]`);
    }

    secondaryChunkTextEditor(chunkIndex: number): Locator {
        return this.page
            .locator(".e2eSecondary-text [contenteditable=\"true\"]")
            .nth(chunkIndex);
    }

    visualsInChunk(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-visuals")
            .nth(chunkIndex)
            .locator(".chunk-images-thumbnail");
    }

    thumbnailOuterWrapper(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-visuals")
            .nth(chunkIndex)
            .locator(".thumbnail-outer-wrapper");
    }

    chunkUploadButton(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-visuals")
            .nth(chunkIndex)
            .locator(".uploadbutton");
    }

    chunkContextMenu(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-text")
            .nth(chunkIndex)
            .locator(".chunk-contextmenu");
    }

    uploadProgessOverlay(chunkIndex: number): Locator {
        return this.page
            .locator(".chunkNEW-visuals")
            .nth(chunkIndex)
            .locator(".progress-overlay-bar");
    }

    getTitleTextAreaWithText(text: string): Locator {
        return this.page.locator(`.chunkNEW-text textarea >> text="${text}"`);
    }

    getLanguageSwitcherOption(language: string): Locator {
        return this.page.locator(`.language-selectors-selector-dropdown >> li:has-text("${language}")`);
    }

    getRightPaneButton(pane: "media"): Locator {
        const iconName = {
            media: "image"
        }[pane]
        return this.page.locator(`.rightPane button .MuiIcon-root:has-text("${iconName}")`);
    }
}
