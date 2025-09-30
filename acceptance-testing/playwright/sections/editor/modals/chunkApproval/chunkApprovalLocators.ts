import { TestSectionLocators } from "../../testsectionlocators";

export class ChunkApprovalLocators extends TestSectionLocators {
    confirmButton = this.page.locator(".button:has-text(\"Yes\")")
    cancelButton = this.page.locator(".button:has-text(\"No\")")
    modalBody = this.page.locator(".approval-modal .modal-body");
}
