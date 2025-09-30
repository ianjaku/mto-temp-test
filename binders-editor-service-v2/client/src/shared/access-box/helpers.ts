export const SectionCollapsedHeight = 56;
export const SectionHalwayHeight = 195;

export function maybeAnimateSection(
    isActive: boolean,
    wasActive: boolean,
    setHeight: (h: number | "auto") => void,
    onExpand?: () => void,
    onCollapse?: () => void
): void {
    if (isActive && !wasActive) {
        setHeight(SectionHalwayHeight)
        setTimeout(() => {
            setHeight("auto");
        }, 200);
        onExpand?.();
    }
    if (!isActive && wasActive) {
        setHeight(SectionCollapsedHeight);
        onCollapse?.();
    }
}

export function sectionIsExpanded(height: number | "auto"): boolean {
    return height === "auto" || height > SectionCollapsedHeight;
}