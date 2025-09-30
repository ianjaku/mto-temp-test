import { ChunkApprovalLocators } from "./chunkApprovalLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";

export class ChunkApproval extends TestSection {

    private readonly locators = new ChunkApprovalLocators(this.context);

    async cancel(): Promise<void> {
        await this.locators.cancelButton.click();
    }

    async confirm(): Promise<void> {
        await this.locators.confirmButton.click()
    }

    async expectModalBodyTextToContain(text: string): Promise<void> {
        await expect(this.locators.modalBody).toContainText(text);
    }

}
