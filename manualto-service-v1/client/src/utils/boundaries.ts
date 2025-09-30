const TOP = 0;
const BOT = 1;

const MAX_IMAGE_HEIGHT_VH = 66;

export function findClosest(isLandscape: boolean, boundariesMap: [number, number][]): number {
    const imageHeight = isLandscape ?
        window.innerHeight :
        Math.min(window.innerWidth, window.innerHeight * MAX_IMAGE_HEIGHT_VH / 100);
    const availabeTextSpace = isLandscape ?
        window.innerHeight :
        (window.innerHeight - imageHeight);

    if (boundariesMap.length === 0) {
        throw new Error("Boundary map is empty");
    }
    if (boundariesMap.length === 1) return 0;

    const value = window.scrollY + availabeTextSpace / 2;
    if (value < boundariesMap.at(0)[TOP]) return 0;
    if (value > boundariesMap.at(-1)[BOT]) return boundariesMap.length - 1;

    let pos = 0;
    for (const mapEntry of boundariesMap) {
        const [x, y] = mapEntry;
        if (x <= value && y > value) {
            return pos;
        }
        pos++;
    }
}
