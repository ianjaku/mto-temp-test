import { Locator } from "@playwright/test";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class DocumentLocators extends TestSectionLocators {
    activeChunk = this.page.locator(".chunk.active");
    nextChunk = this.page.locator(".chunk.active + .chunk");
    activeChecklist = this.page.locator(".chunk.active .checklistStatusButton");
    activeChecklistWrapper = this.page.locator(".chunk.active .checklistStatus");
    upButton = this.page.locator(".material-icons >> text=home");
    nextDocumentButton = this.page.locator(".material-icons >> text=arrow_forward");
    prevDocumentButton = this.page.locator(".material-icons >> text=arrow_back");
    allChunks = this.page.locator(".text-module .chunk");
    machineTranslationButton = this.page.locator(".material-icons >> text=translate");
    collapsedToolbarLanguage = this.page.locator(".toolbarLanguage--collapsed");
    toolbarExpandTrigger = this.page.locator(".material-icons >> text=menu");
    ownershipButton = this.page.locator(".material-icons >> text=person");
    ownersPopout = this.page.locator(".toolbarActions-ownerInfo");

    activeChunkText(index: number): Locator {
        return this.page.locator(`.text-module .chunk.active:nth-child(${index + 1}) .chunk-html`);
    }

    carrouselNextVisual(chunkNumber: number): Locator {
        return this.page.locator(
            `div:nth-child(${chunkNumber}) > .slider > .slider-control-centerright > .carousel-arrow-button`
        );
    }

    chunkText(index: number): Locator {
        return this.page.locator(`.text-module .chunk:nth-child(${index + 1}) .chunk-html`);
    }

    chunkDisclaimer(index: number): Locator {
        return this.chunkText(index).locator(".disclaimer-content");
    }

    getNthChunkWithContent(chunkNumber: number, content: string): Locator {
        return this.page.locator(
            `.text-module .chunk:nth-child(${chunkNumber}) >> text="${content}"`
        );
    }

    getNthVisualIncludingSrc(chunkNumber: number, srcPart: string): Locator {
        return this.page.locator(
            // :not(.phImgBlur):not(.image) makes it so we only match the final image, not the progressive placeholders
            `.media-module .image-wrapper:nth-child(${chunkNumber}) >> img:not(.phImgBlur):not(.image)[src*="${srcPart}"]`
        );
    }

    private visualContainerSelector(chunk: number, carrouselPosition: number): string {
        const chunkSelector = `//*[contains(@class, "media-viewport")]/*[contains(@class, "image-wrapper")][${chunk}]`;
        const carrouselPositionSelector = `${chunkSelector}//*[contains(@class,"slider-slide")][${carrouselPosition}]`;
        const visualContainerSelector = carrouselPosition > 0 ? carrouselPositionSelector : chunkSelector;
        return visualContainerSelector;
    }

    /**
    * Returns locator of a image, or video visual
    * @argument chunk
    * @argument carrouselPosition - if negative, the visual should not be in a carrousel
    */
    visual(chunk: number, carrouselPosition: number): Locator {
        const visualContainerSelector = this.visualContainerSelector(chunk, carrouselPosition);
        const imageSelector = `${visualContainerSelector}//img`;
        const videoSelector = `${visualContainerSelector}//video`;
        const imageOrVideo = `${imageSelector}|${videoSelector}`;
        return this.page
            .locator(imageOrVideo)
            .first()
    }

    videoStillTranscoding(chunk: number, carrouselPosition: number): Locator {
        const visualContainerSelector = this.visualContainerSelector(chunk, carrouselPosition);
        return this.page.locator(`${visualContainerSelector}//div[contains(@class,"video-placeholder-transcoding")]`);
    }

    getPreloadedInfoInput(videoId: string): Locator {
        return this.page.locator(`input[name='${videoId}-preloaded']`);
    }

    getActiveLanguageLabelWithName(languageName: string): Locator {
        return this.page.locator(`.toolbarLanguage-minimal-selectedLanguage:has-text("${languageName}")`);
    }

    getLanguageButton(languageCode: string): Locator {
        return this.page.locator(`.toolbarLanguage-minimal-languageCodes-button:has-text("${languageCode}")`)
    }

    getSelectedLanguageLabel(languageNativeName: string): Locator {
        return this.page.locator(`.toolbarLanguage-minimal-selectedLanguage:has-text("${languageNativeName}")`)
    }

}
