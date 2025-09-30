import { BatchactionsLocators } from "./batchactionLocators";
import { TestSection } from "../../testsection"

export class BatchActions extends TestSection {
    private readonly locators = new BatchactionsLocators(this.context);

    async publishFirstLanguage(): Promise<void> {
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.batchActionSelector.click();
        // In tests the dropdown can disappear immediately after being opened
        // Until we figure out what's the issue, we can try to reopen
        // if (!await this.locators.recursivePublishAction.isVisible()) {
        //     await this.locators.batchActionSelector.click();
        // }
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.recursivePublishAction.click();
        await this.locators.firstLanguage.check();
        await this.locators.modalProceed.click();
        await this.locators.modalProceed.click();
        await this.locators.modalDone.click();
    }

    async delete(shouldBeBlocked: boolean, itemCount: number): Promise<void> {
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.batchActionSelector.click();
        // In tests the dropdown can disappear immediately after being opened
        // Until we figure out what's the issue, we can try to reopen
        // if (!await this.locators.recursiveDelete.isVisible()) {
        //     await this.locators.batchActionSelector.click();
        // }
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.recursiveDelete.click();
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.modalProceed.click();
        if (shouldBeBlocked) {
            await this.locators.deleteShouldBeBlocked.waitFor();
            await this.locators.modalClose.click();
            return;
        }
        await this.locators.deleteConfirmation.click();
        await this.locators.deleteConfirmation.fill(itemCount.toString());
        await this.locators.modalProceed.click();
    }

    async unpublishLanguage(index: number): Promise<void> {
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.batchActionSelector.click();
        // In tests the dropdown can disappear immediately after being opened
        // Until we figure out what's the issue, we can try to reopen
        // if (!await this.locators.recursiveUnpublishAction.isVisible()) {
        //     await this.locators.batchActionSelector.click();
        // }
        // Test flakeyness alert: See if this fixes the issue wit the dropdown not disappearing
        await this.wait(100);
        await this.locators.recursiveUnpublishAction.click();
        await this.locators.nthLanguage(index).check();
        await this.locators.modalProceed.click();
        await this.locators.modalProceed.click();
        await this.locators.modalDone.click();
    }
}