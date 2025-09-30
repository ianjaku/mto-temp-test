import { IDims } from "../clients/imageservice/v1/contract";

export function scale({
    dims,
    preserveAspectRatio = true,
    viewport,
}: {
    dims: IDims;
    preserveAspectRatio?: boolean;
    viewport: IDims;
}): IDims {
    const dimsAspectRatio = dims.height > 0 ? dims.width / dims.height : undefined;
    const viewportAspectRatio = viewport.height > 0 ? viewport.width / viewport.height : undefined;
    if (!dimsAspectRatio || !viewportAspectRatio) return {
        width: 0,
        height: 0,
    };
    if (!preserveAspectRatio) return {
        width: Math.min(dims.width, viewport.width),
        height: Math.min(dims.height, viewport.height),
    }
    const isOverflowWidth = viewport.width < dims.width;
    const isOverflowHeight = viewport.height < dims.height
    const isOverflow = isOverflowWidth || isOverflowHeight;
    let videoWidth = dims.width;
    let videoHeight = dims.height;
    if (isOverflow) {
        const scaleX = isOverflowWidth ? dims.width / viewport.width : 1;
        const scaleY = isOverflowHeight ? dims.height / viewport.height : 1;
        const scaleFactor = Math.max(scaleX, scaleY);
        videoWidth /= scaleFactor;
        videoHeight /= scaleFactor;
    }

    return {
        width: videoWidth,
        height: videoHeight,
    }
}
