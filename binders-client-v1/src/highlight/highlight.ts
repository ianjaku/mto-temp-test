import { cutStringAt, indexOfIgnoreHtml } from "./html_util";

export interface IPartialBoundary {
    text: string;
    offsetMS: number;
}

export interface IBoundary {
    text: string;
    offsetMS: number;
    index: number;
}

export function addMarkToHtml(
    html: string,
    boundary: IBoundary
): string {
    if (boundary.index === -1) return html;
    const {start, middle, end} = cutStringAt(html, boundary.index, boundary.text.length);
    return `${start}<mark>${middle}</mark>${end}`;
}

export function addIndexToBoundaries(
    html: string,
    boundaries: IPartialBoundary[],
): IBoundary[] {
    let previousIndexEnd = 0;
    return boundaries.map(boundary => {
        const index = indexOfIgnoreHtml(html, boundary.text, previousIndexEnd);
        previousIndexEnd = index === -1 ? previousIndexEnd : index + boundary.text.length;
        return {
            text: boundary.text,
            offsetMS: boundary.offsetMS,
            index
        }
    })
}
