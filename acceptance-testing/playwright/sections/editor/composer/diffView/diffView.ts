import { DiffViewLocators } from "./diffViewLocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";

export class DiffView extends TestSection {

    private locators = new DiffViewLocators(this.context);

    async acceptUpdatedChunk(chunkIdx: number): Promise<void> {
        await this.locators.acceptChunkButton(chunkIdx).click();
    }

    async clickContinueToDocumentButton(): Promise<void> {
        await this.locators.continueToDocumentButton.click();
    }

    async expectOriginalChunkValue(chunkIdx: number, value: string): Promise<void> {
        await expect(this.locators.originalChunk(chunkIdx)).toContainText(value);
    }

    async expectMergedChunkValue(chunkIdx: number, mergeLabel: string, value: string): Promise<void> {
        await expect(this.locators.mergedChunk(chunkIdx)).toContainText(value);
        await expect(this.locators.mergedChunkLabel(chunkIdx)).toContainText(mergeLabel);
    }

    async expectUpdatedChunkValue(chunkIdx: number, value: string): Promise<void> {
        await expect(this.locators.updatedChunk(chunkIdx)).toContainText(value);
    }

    async rejectUpdatedChunk(chunkIdx: number): Promise<void> {
        await this.locators.rejectChunkButton(chunkIdx).click();
    }

    async retryChunk(chunkIdx: number): Promise<void> {
        await this.locators.retryChunkButton(chunkIdx).click();
    }

}
