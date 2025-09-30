export function extractDomainPrefix(domain: string): string {
    const pieces = domain.match(/(.*\.)(manual\.to)/);
    return (pieces && pieces[1]) || "";
}

export function doElementsOverlap(firstElement: Element, secondElement: Element): boolean {
    if (!firstElement || !secondElement) {
        return false;
    }

    const rect1 = firstElement.getBoundingClientRect();
    const rect2 = secondElement.getBoundingClientRect();

    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}