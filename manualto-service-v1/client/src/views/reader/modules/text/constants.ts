/*
    This determines the resolution with which the font size can be pinch zoomed.
    A value of 10 for example would be 0.1 for the smallest unit.
    A value of 100 would be 0.01 for the smallest unit.
    This will greatly affect pinch zoom performance.
    Lower = faster, because there are less renders to go through React.
*/
export const FONT_SIZE_RESOLUTION = 7;

export const DEFAULT_BOTTOM_PADDING_CHUNK_CONTENT_VH = 12;
export const DEFAULT_FONTSIZE_PX = 16;
export const MAX_FONT_SIZE_FACTOR = 2.5;
export const MIN_FONT_SIZE_FACTOR = 0.6;
export const MIN_TOP_PADDING_CHUNK_LANDSCAPE = 70;
export const MIN_TOP_PADDING_CHUNK_PORTRAIT = 20;
export const MIN_TOP_PADING_CHUNK_SQUARE = 50;
export const SCROLL_OFFSET = 25;

export const KEYBOARD_KEYS = {
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    SPACE: 32,
};

export const SIZE_HINTS = {
    novel: 0.8,
    "child-novel": 1.1,
    "single-word": 2.5
};

// elements marked as interactive, preventing the TextModule from acting upon clicks inside them
export const INTERACTIVE_TEXTMODULE_ELEMENT_CLASSNAMES = [
    "chunk-feedback",
]
export const INTERACTIVE_ELEMENT_TAGNAMES = ["INPUT", "TEXTAREA", "BUTTON", "SELECT", "OPTION", "A"];

// The minimum width a chunk element can have to still be reasonably readable
export const MIN_CHUNK_ELEMENT_WIDTH = 275;