import { Locator } from "@playwright/test";
import { TestSectionLocators } from "../../testsectionlocators";
import ts from "@binders/client/lib/i18n/translations/en_US";

export class DiffViewLocators extends TestSectionLocators {

    continueToDocumentButton = this.page.locator(`.button--CTA:has-text("${ts.General_Confirm}")`);

    public originalChunk(chunkIdx: number): Locator {
        return this.page.locator(`.chunk-dragwrapper.chunk-${chunkIdx + 1}.isPrimary`);
    }

    public updatedChunk(chunkIdx: number): Locator {
        return this.page.locator(`.chunk-dragwrapper.chunk-${chunkIdx + 1}.isSecondary`);
    }

    public mergedChunk(chunkIdx: number): Locator {
        return this.page.locator(`.chunk-dragwrapper.chunk-${chunkIdx + 1}.isPrimary`);
    }

    public mergedChunkLabel(chunkIdx: number): Locator {
        return this.mergedChunk(chunkIdx).locator(".chunk-controls-diff-labels");
    }

    public chunkDiffControls(chunkIdx: number): Locator {
        return this.page.locator(`.chunk-controls-diff-${chunkIdx + 1}`);
    }

    public acceptChunkButton(chunkIdx: number): Locator {
        return this.chunkDiffControls(chunkIdx).locator(".diff-control-accept");
    }

    public rejectChunkButton(chunkIdx: number): Locator {
        return this.chunkDiffControls(chunkIdx).locator(".diff-control-reject");
    }

    public retryChunkButton(chunkIdx: number): Locator {
        return this.chunkDiffControls(chunkIdx).locator(".diff-control-retry");
    }

}

