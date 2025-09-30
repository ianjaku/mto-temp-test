// Helpers to make working with raw html easier


/**
 * Removes span tags from a raw html string.
 */
export function removeUnnecessaryTags(html: string): string {
    return html
        .replace(/<\/?(span|strong|em|u|a)( [^>]*)?>/gi, "") // Remove tags
        .replace(/&[^;]+;/gi, ""); // Remove special characters
}

/**
 * Extracts the raw text from html split into an array around the tags.
 */
export function textFromHtml(html: string): string[] {
    return removeUnnecessaryTags(html)
        .trim()
        .replace(/<\/?[^<>]+>/ig, "|")
        .replace(/(?:\r\n|\r|\n)/g, "")
        .split("|")
        .map(v => v.trim())
        .filter(v => v != null && v.length > 0);
}

export function cutStringAt(
    str: string,
    index: number,
    length: number
): {
    start: string;
    middle: string;
    end: string;
} {
    const start = str.slice(0, index);
    const middle = str.slice(index, index + length);
    const end = str.slice(index + length);
    return {start, middle, end}
}

/**
 * The same as String.prototype.indexOf but ignores html
 */
export function indexOfIgnoreHtml(
    hayStack: string,
    needle: string,
    startFromIndex = 0
): number {
    let needleIndex = 0;
    let inHtml = false;
    for (let i = startFromIndex; i < hayStack.length; i ++) {
        const char = hayStack[i];
        if (char === ">") {
            inHtml = false;
            continue;
        }
        if (char === "<") {
            inHtml = true;
            continue;
        }
        if (inHtml) continue;

        if (needle[needleIndex] !== char) {
            needleIndex = 0;
            continue;
        }
        if (needleIndex === needle.length - 1) {
            return i - needleIndex;
        }
        needleIndex += 1;
    }
    return -1;
}
