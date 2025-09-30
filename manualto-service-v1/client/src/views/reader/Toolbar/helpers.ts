import vars from "../../../vars.json";

const BUTTON_OVERLAP_PERCENTAGE = 0.1;
const HIGHLIGHT_OFFSET = 34;

export const getSubToolbarWidth = (btnCount: number): string => {
    const baseWidth = btnCount * vars.toolbarHeight;
    const overlap = btnCount === 1 ? 0 : baseWidth * BUTTON_OVERLAP_PERCENTAGE;
    return `${baseWidth - overlap}px`;
}

export const getHightlightLeftPosition = (hoveredButtonIndex: number): string => {
    return `${hoveredButtonIndex * HIGHLIGHT_OFFSET}px`;
}
