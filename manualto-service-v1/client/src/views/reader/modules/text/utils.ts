import * as React from "react";
import {
    FEEDBACK_CHUNK_DATAPROP,
    HIDDEN_CHUNK_DATAPROP,
    MANUALTO_CHUNK_DATAPROP,
    READ_CONFIRMATION_CHUNK_DATAPROP,
    TITLE_CHUNK_DATAPROP
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import {
    FONT_SIZE_RESOLUTION,
    MAX_FONT_SIZE_FACTOR,
    MIN_FONT_SIZE_FACTOR,
    MIN_TOP_PADDING_CHUNK_LANDSCAPE,
    MIN_TOP_PADDING_CHUNK_PORTRAIT,
    MIN_TOP_PADING_CHUNK_SQUARE
} from "./constants";
import {
    IUserActionDataChecklistCompleted,
    UserActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { APIMultiInsertUserAction } from "../../../../api/trackingService";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ScrollDirection } from "./types";
import { isSquared } from "../../../../utils/viewport";


export function animateToChunk(chunk: Element, isLandscape = false, dir = ScrollDirection.Down): void {
    if (!chunk) return;
    const targetScrollTop = findScrollTarget(chunk as HTMLElement, isLandscape, dir);
    window.scroll({ top: targetScrollTop, left: 0, behavior: "smooth" });
}

export function calculateNewFontSize(currentFactor: number, scale: number): number {
    return Math.min(
        MAX_FONT_SIZE_FACTOR,
        Math.max(MIN_FONT_SIZE_FACTOR, Math.round(currentFactor * scale * FONT_SIZE_RESOLUTION) / FONT_SIZE_RESOLUTION)
    );
}

/**
 *
 * @param input: { dangerouslyProvidedHtmlString: string }: make sure string doesn't contain unsanitized user input
 */
export function createElementFromHTML(input: { dangerouslyProvidedHtmlString: string }): Element {
    const div = document.createElement("div");
    div.innerHTML = input.dangerouslyProvidedHtmlString.trim();
    return div.firstChild as Element;
}

export function getChunkElements(el: Element | Text): Element[] {
    if (!el || el.nodeType === Node.TEXT_NODE) return [];
    return Array.from((el as Element).getElementsByClassName("chunk-content"));
}

/**
    * Returns the "top" position of the given chunk.
    * If the chunk fits in the text module, the chunk will be centered
    * If the chunk does not fit in the text module, we will scroll to the top of the chunk
    */
export function findScrollTarget(chunkEl: HTMLElement, isLandscape: boolean, dir: ScrollDirection): number {
    let targetScrollTop = 0;
    // In case the chunk won"t fit in our view, scroll to the top of the chunk.
    const availabeTextSpace = isLandscape ? window.innerHeight : (window.innerHeight - window.innerWidth);

    if (availabeTextSpace <= chunkEl.clientHeight) {
        targetScrollTop = (
            dir === ScrollDirection.Down ?
                chunkEl.offsetTop :
                chunkEl.offsetTop + chunkEl.children[0].clientHeight - availabeTextSpace / 2
        );
    } else {
        // Otherwise center it.
        const chunkCenterY = chunkEl.offsetTop + chunkEl.clientHeight / 2;
        targetScrollTop = chunkCenterY - availabeTextSpace / 2;
    }
    return targetScrollTop;
}

export function getElementPosition(e: React.MouseEvent<Element, MouseEvent>): { positionX: number, positionY: number } {
    const imageModule = document.getElementsByClassName("media-module").item(0);
    const { clientHeight, clientWidth } = imageModule;
    const isPortrait = window.innerWidth < 1320;
    return {
        positionX: isPortrait ? e.clientX : e.clientX - clientWidth,
        positionY: isPortrait ?
            Math.min(
                e.clientY - clientHeight + 20,
                document.body.clientHeight - clientHeight + 20,
            ) :
            e.clientY + 8,
    }
}

export function getMinPadding(isLandscape: boolean): number {
    if (isSquared()) return MIN_TOP_PADING_CHUNK_SQUARE;
    return isLandscape ? MIN_TOP_PADDING_CHUNK_LANDSCAPE : MIN_TOP_PADDING_CHUNK_PORTRAIT;
}

export function isSafari(): boolean {
    return ("GestureEvent" in window);
}

export function logChecklistCompleted(
    accountId: string,
    userId: string,
    // Checklists only work in publications, so viewable will always be a publication here
    viewable: Publication,
    binderId: string,
): Promise<void> {
    return APIMultiInsertUserAction<IUserActionDataChecklistCompleted>([{
        accountId,
        userActionType: UserActionType.CHECKLIST_COMPLETED,
        userId,
        data: {
            publicationId: viewable.id,
            itemId: binderId,
            itemKind: "document",
            itemTitle: viewable.language.storyTitle
        }
    }], accountId);
}

export function scrollDownCurrentChunk(textModuleHeight: number, stop: number): void {
    const currentScrollTopPosition = window.pageYOffset;
    const currentInterval = 0.9 * textModuleHeight;
    // we would exceed chunkHeight if we add our interval
    if (currentScrollTopPosition + currentInterval > stop) {
        window.scroll({ top: stop, left: 0, behavior: "smooth" });
        // we can still scroll with our interval
    } else {
        window.scroll({ top: currentScrollTopPosition + currentInterval, left: 0, behavior: "smooth" });
    }
}

export function scrollUpCurrentChunk(textModuleHeight: number, stop: number): void {
    const currentScrollTopPosition = window.pageYOffset;
    const currentInterval = 0.9 * textModuleHeight;
    // we would exceed chunkHeight if we add our interval
    if (currentScrollTopPosition - currentInterval < stop) {
        window.scroll({ top: stop, left: 0, behavior: "smooth" });
    } else {
        window.scroll({ top: currentScrollTopPosition - currentInterval, left: 0, behavior: "smooth" });
    }
}

// function that copies styles from <li><span STYLE> to <li STYLE>, to fix font size of list item label in ordered lists (MT-1782, MT-3325)
export function transformListsStyles(html: string): string {
    if (!(/<ol>/g.test(html))) {
        // no ordered list detected
        return html;
    }
    const listItemsWithImmediateSpanChild = /<li><span.*?<\/li>/gm;
    if (listItemsWithImmediateSpanChild.test(html)) {
        const listElementsToTransform = html.match(listItemsWithImmediateSpanChild);
        listElementsToTransform.forEach(listElement => {
            const el = createElementFromHTML({ dangerouslyProvidedHtmlString: listElement });
            if (el.hasChildNodes() && el.firstChild.nodeType !== Node.TEXT_NODE) {
                const firstChildElement = el.firstChild as Element;
                const style = firstChildElement.getAttribute("style");
                firstChildElement.removeAttribute("style");
                el.setAttribute("style", style);
            }
            html = html.replace(listElement, el.outerHTML);
        })
    }
    return html;
}

export const isFeedbackChunk = (chunk: string[]): boolean => {
    return chunk && chunk.some(paragraph => isFeedbackChunkParagraph(paragraph));
}

export const isFeedbackChunkParagraph = (p: string): boolean =>
    p.includes(FEEDBACK_CHUNK_DATAPROP);

export const isHiddenChunk = (chunk: string[]): boolean =>
    chunk && chunk.some(paragraph => paragraph.includes(HIDDEN_CHUNK_DATAPROP));

export const isManualToChunk = (chunk: string[]): boolean =>
    chunk && chunk.some(paragraph => paragraph.includes(MANUALTO_CHUNK_DATAPROP));

export const isManualToEl = (el: HTMLElement): boolean =>
    el.innerHTML.includes(MANUALTO_CHUNK_DATAPROP);

export const isFeedbackEl = (el: HTMLElement): boolean =>
    el.innerHTML.includes(FEEDBACK_CHUNK_DATAPROP);

export const isTitleChunk = (chunk: string[]): boolean =>
    chunk && chunk.some(paragraph => paragraph.includes(TITLE_CHUNK_DATAPROP));

export const isReadConfirmationChunk = (chunk: string[]): boolean =>
    chunk && chunk.some(paragraph => paragraph.includes(READ_CONFIRMATION_CHUNK_DATAPROP));


/**
 * Determine the font-size to use for paragraphs. If an override is set, use that
 */
export const getParagraphFontSize = (fontSize: string): string => {
    const customTagsStyles = window.bindersBranding.stylusOverrideProps?.customTagsStyles ?? [];
    const paragraphStyle = customTagsStyles.find(style => style.tag === "p")?.style;
    if (paragraphStyle) {
        const fontSizeStyle = paragraphStyle.split(";").find(style => style.includes("font-size"));
        if (fontSizeStyle) {
            return fontSizeStyle.split(":")[1].trim();
        }
    }
    return fontSize;
}