
function findElementScrollPosition(
    chunkEl: HTMLDivElement,
    isLandscape: boolean
): number {
    // The height of the text view
    // On mobile the height of the image view is the same as the width of the window, so the height of the text view is the height of the window minus the width of the window.
    const availabeTextSpace = isLandscape ? window.innerHeight : (window.innerHeight - window.innerWidth);

    if (availabeTextSpace <= chunkEl.clientHeight) {
        return chunkEl.offsetTop;
    } else {
        const chunkCenterY = chunkEl.offsetTop + chunkEl.clientHeight / 2;
        return chunkCenterY - availabeTextSpace / 2;
    }
}

export function scrollToChunkIndex(chunkIndex: number, isLandscape: boolean): void {
    const chunks = document.querySelectorAll(".chunk-content");
    const chunk = chunks[chunkIndex] as HTMLDivElement;
    const targetScrollTop = findElementScrollPosition(chunk, isLandscape);
    setTimeout(() => window.scroll({ top: targetScrollTop, left: 0, behavior: "smooth" }), 10);
}

/**
 * Scrolls the parent element to ensure the child element is visible within its viewport. 
 * If the child element is already fully visible, no scrolling occurs. If the child is partially or 
 * not visible, the parent will scroll to make the child element visible. If the child element's height 
 * exceeds the parent's viewport height, the function scrolls to align the child's top with the parent's top.
 * If the child can fit within the parent's viewport, it attempts to center the child in the view.
 *
 * @param parentClassName - The class name of the parent element. Assumes the first element with this class name is the target parent.
 * @param childClassName - The class name of the child element. Assumes the first element with this class name is the target child.
 */
export function scrollToChildElement(parentClassName: string, childClassName: string): void {
    const parent = document.getElementsByClassName(parentClassName).item(0) as HTMLElement
    const child = document.getElementsByClassName(childClassName).item(0) as HTMLElement
    if (parent && child) {
        const viewportTop = parent.scrollTop;
        const viewportBottom = parent.scrollTop + parent.clientHeight;
        const selectedGroupTop = child.offsetTop;
        const selectedGroupBottom = child.offsetTop + child.clientHeight;
        const isFullyVisible = selectedGroupTop > viewportTop && selectedGroupBottom < viewportBottom;
        const willOverflow = selectedGroupBottom - selectedGroupTop > parent.clientHeight;
        const top = willOverflow ?
            child.offsetTop - parent.offsetTop :
            child.offsetTop - parent.clientHeight
        if (isFullyVisible) return
        parent.scroll({ behavior: "auto", top, left: 0 })
    }
}
