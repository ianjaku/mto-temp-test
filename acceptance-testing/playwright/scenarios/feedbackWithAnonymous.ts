import { TestCase } from "../fixtures";

/**
 * Acceptance test for reader user feedback. Functionality tested:
 * 1. Prepare a manual
 * 2. Submitting a feedback (with rating, message, not anonymous)
 * 3. Refreshing and checking again the rating was saved
 * 4. Updating the feedback (clearing the message, updating the rating, marking as anonymous)
 * 5. Updating the feedback (adding a message, clearing the rating)
 * 6. Refreshing and checking the rating was saved
 * 7. Refresh and download the feedbacks in the editor
 */
export class BinderUserFeedbackWithAnonymous extends TestCase {

    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.createNewDocument();

        await editor.composer.fillTitle("Title chunk");
        await editor.composer.fillNewChunk("Second chunk");
        await editor.composer.fillNewChunk("Third chunk");
        await editor.composer.publish(true);

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader();
        await reader.browser.openStoryByTitle("Title chunk");

        await reader.document.waitForChunksCount(4);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();

        await reader.document.feedback.expectDisabledSubmit();
        await reader.document.feedback.enterMessage("foo");
        await reader.document.feedback.expectEnabledSubmit();

        await reader.document.feedback.clearMessage();
        await reader.document.feedback.expectDisabledSubmit();

        await reader.document.feedback.selectStar(4);
        await reader.document.feedback.expectFormRating(4);
        await reader.document.feedback.expectEnabledSubmit();

        await reader.document.feedback.selectStar(4);
        await reader.document.feedback.expectDisabledSubmit();

        await reader.document.feedback.enterMessage("Lorem ipsum dolor sit amet");
        await reader.document.feedback.selectStar(4);
        await reader.document.feedback.expectEnabledSubmit();

        await reader.document.feedback.submitFeedback();

        await reader.document.feedback.expectExistingFeedbackMessage("Lorem ipsum dolor sit amet");
        await reader.document.feedback.expectExistingFeedbackRating(4);

        await readerWindow.reload();

        await reader.document.waitForChunksCount(4);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();

        await reader.document.feedback.expectFormHidden();
        await reader.document.feedback.expectExistingFeedbackMessage("Lorem ipsum dolor sit amet");
        await reader.document.feedback.expectExistingFeedbackRating(4);

        await reader.document.feedback.changeFeedback();
        await reader.document.feedback.clearMessage();
        await reader.document.feedback.selectStar(2);
        await reader.document.feedback.checkStayAnonymous();
        await reader.document.feedback.expectEnabledSubmit();

        await reader.document.feedback.submitFeedback();

        await reader.document.feedback.expectMissingFeedbackMessage();
        await reader.document.feedback.expectExistingFeedbackRating(2);

        await reader.document.feedback.changeFeedback();
        await reader.document.feedback.selectStar(2);
        await reader.document.feedback.expectDisabledSubmit();
        await reader.document.feedback.enterMessage("consectetur adipiscing elit");
        await reader.document.feedback.expectEnabledSubmit();

        await reader.document.feedback.submitFeedback();

        await reader.document.feedback.expectExistingFeedbackMessage("consectetur adipiscing elit");
        await reader.document.feedback.expectMissingFeedbackRating();

        await readerWindow.reload();

        await reader.document.waitForChunksCount(4);
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();
        await reader.document.goToNextChunk();

        await reader.document.feedback.expectFormHidden();
        await reader.document.feedback.expectExistingFeedbackMessage("consectetur adipiscing elit");
        await reader.document.feedback.expectMissingFeedbackRating();

        await editorWindow.reload();
        await editor.rightPane.openManualRatings();
        await editor.rightPane.downloadManualRatings();
    }
}
