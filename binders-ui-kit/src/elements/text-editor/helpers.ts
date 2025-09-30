import {
    ContentState,
    EditorState,
    Modifier,
    SelectionState,
    convertFromHTML,
    getVisibleSelectionRect
} from "draft-js";
import getEntityDataFromCurrentBlock, { extractSelectedText } from "./custom/entities";
import { Hyperlink } from "./components/LinkCreator";
import { isIE10Plus } from "../../helpers/helpers";

export interface IToolbarPositionOptions {
    forceBottom?: boolean;
    forceTop?: boolean;
}

export interface IToolbarPosition {
    top: number;
    left: number;
    isBottomArrow: boolean;
    arrowLeft: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function calculateAlternativeRect() {
    const clientRects =
        window.getSelection() &&
        window.getSelection().rangeCount > 0 &&
        window.getSelection().getRangeAt(0).getClientRects();
    if (!clientRects) {
        return null;
    }

    const rectKeys = Object.keys(clientRects);
    const rects = rectKeys.map(key => clientRects[key]);
    const alternativeRect = rectKeys.reduce((finalRect, key) => {
        const rect = clientRects[key];
        return rect && rect.width > 0 ? rect : finalRect;
    }, {});

    return {
        bottom: alternativeRect.bottom,
        left: rects.reduce((left, rect) => Math.min(rect.left, left), 700),
        top: alternativeRect.top,
        width: rects.reduce((width, rect) => Math.min(rect.width, width), 0),
    };
}

export function calculateToolbarPosition(
    selection: SelectionState,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    rteRoot,
    options?: IToolbarPositionOptions
): IToolbarPosition | undefined {
    if (!selection || !rteRoot) {
        return undefined;
    }
    const forceBottom = options && options.forceBottom;
    const forceTop = options && options.forceTop;
    const isMobile = window.innerWidth < 480;
    const toolbarTopCorrection = isIE10Plus() ? 40 : 30;
    const isMultiBlock = selection.getAnchorKey() !== selection.getFocusKey();
    const alternativeRect = calculateAlternativeRect();
    const visibleSelectionRect = isMultiBlock ? alternativeRect : getVisibleSelectionRect(window);
    const rteRootRect = rteRoot.getBoundingClientRect();
    if (visibleSelectionRect && rteRootRect) {
        const calculatedTop =
            visibleSelectionRect.top - rteRootRect.top -
            (isMobile ? 24 : 0);
        let left = Math.min(visibleSelectionRect.left - rteRootRect.left, rteRootRect.width - 480 - 10);
        left = visibleSelectionRect.width > 20 ? left : left - 20 + visibleSelectionRect.width;
        left = isMultiBlock ? left + 10 : left;
        let top = calculatedTop > 0 ? calculatedTop : visibleSelectionRect.top - rteRootRect.top + toolbarTopCorrection;
        const arrowLeft = Math.max(visibleSelectionRect.left - left - rteRootRect.left + visibleSelectionRect.width / 2, 10);

        let isToolbarBottom;
        if (forceBottom) {
            isToolbarBottom = true;
        } else if (forceTop) {
            isToolbarBottom = false;
        } else if (isMultiBlock) {
            isToolbarBottom = true;
        } else if (calculatedTop > 0) {
            isToolbarBottom = false;
        } else {
            isToolbarBottom = true;
        }

        const isBottomArrow = !isToolbarBottom;
        top += isToolbarBottom ? 26 : -50;
        return {
            top,
            left,
            arrowLeft,
            isBottomArrow,
        };
    }
    return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formattingDetected(html: string): boolean {
    return true;
}

export function spliceInPastedContent(editorState: EditorState, content: string, options: { isHtml: boolean }): ContentState {
    const { isHtml } = options;
    const currentContent = editorState.getCurrentContent();
    const currentSelection = editorState.getSelection();
    if (!isHtml) {
        // if we have multiline to be treated as text
        // we want to keep the blocks
        // only forget the styling
        // that's why we wrap it with block p
        const split = content.split(/[\n\r]/g);
        const newHTML = split.reduce((acc, line) => `${acc}<p>${line}</p>`);
        const { contentBlocks: pastedBlocks } = convertFromHTML(newHTML);
        const pastedBlockMap = ContentState.createFromBlockArray(pastedBlocks).getBlockMap();
        return Modifier.replaceWithFragment(
            currentContent,
            currentSelection,
            pastedBlockMap
        );
    }
    const { contentBlocks: pastedBlocks } = convertFromHTML(content);
    const pastedBlockMap = ContentState.createFromBlockArray(pastedBlocks).getBlockMap();
    return Modifier.replaceWithFragment(
        currentContent,
        currentSelection,
        pastedBlockMap,
    );
}

export function getHyperlinkFromEditorStateSelection(editorState: EditorState): Hyperlink {
    const { text, url, target, isCallToLink } = getEntityDataFromCurrentBlock(editorState);
    const hyperlinkText = text || extractSelectedText(editorState);
    const hyperlinkUrl = isCallToLink ? url.replace("tel:", "") : url;
    return {
        url: hyperlinkUrl,
        text: hyperlinkText,
        target: target || "_blank",
        isCallToLink,
    }
}

function ensureCorrectProtocol(url: string): string {
    return url.replace(/^(https?:)(\/+)/, "$1//");
}

const PROTOCOL_PREFIX_REGEX = new RegExp("^[a-zA-Z]+://");
const MAIL_TO_PREFIX_REGEX =  new RegExp("^mailto:");
function ensureProtocolPrefix(url: string): string {
    return PROTOCOL_PREFIX_REGEX.test(url) || MAIL_TO_PREFIX_REGEX.test(url) ?
        url :
        `https://${url}`;
}

export function normalizeHyperlinkUrl(url: string): string {
    if (!url) {
        return "";
    }
    const trimmedUrl = url.trim();
    if (trimmedUrl === "") {
        return trimmedUrl;
    }
    const fixedUrl = ensureCorrectProtocol(trimmedUrl);
    return ensureProtocolPrefix(fixedUrl);
}

function normalizeCallToLink(callToLink: string): string {
    return callToLink.trim().replace(/[^+\d]/g, "");
}

export function normalizeHyperlink(hyperlink: Hyperlink): Hyperlink {
    const { url, isCallToLink } = hyperlink;
    const normalizedUrl = isCallToLink ? normalizeCallToLink(url) : normalizeHyperlinkUrl(url);
    return { ...hyperlink, url: normalizedUrl };
}

export function validateHyperlink(hyperlink: Hyperlink): string[] {
    const { url, isCallToLink } = hyperlink;
    if (isCallToLink && url.length === 0) {
        return ["General_PhoneNumberError"];
    }
    return [];
}