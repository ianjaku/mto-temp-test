export const isLandscape = () => window.matchMedia("(orientation: landscape)").matches;
export const isPortrait = () => window.matchMedia("(orientation: portrait)").matches;
export const isSquared = () => {
    const aspectRatio = window.innerHeight / window.innerWidth;
    return aspectRatio >= 0.98 && aspectRatio <= 1.02;
}

export const originalToDeviceDimension = (dim) => {
    return dim / (window.devicePixelRatio || 1);
}
