import { Locator } from "@playwright/test";
import { TestSectionLocators } from "../testsectionlocators";


export class BatchactionsLocators extends TestSectionLocators {
    batchActionSelector = this.page.locator(".recursiveA-modal-content .dropdown-field");
    recursivePublishAction = this.page.locator(".recursiveA-modal ul.dropdown-elements .dropdown-field-label-group-text:has-text('Publish')").first();
    firstLanguage = this.nthLanguage(0);
    nthLanguage(n: number): Locator {
        return this.page.locator("input[type=\"checkbox\"]").nth(n);
    }
    modalProceed = this.page.locator(".button >> text=Proceed");
    modalClose = this.page.locator(".button >> text=Close");
    modalDone = this.page.locator("main >> text=Done");
    recursiveDelete = this.page.locator("li:has-text('deleteRemove')");
    deleteShouldBeBlocked = this.page.locator("text=be invoked, see errors below");
    recursiveUnpublishAction = this.page.locator(".recursiveA-modal ul.dropdown-elements .dropdown-field-label-group-text:has-text('Unpublish')");
    deleteConfirmation = this.page.locator("input[name='explicitconfirmation']");
}
