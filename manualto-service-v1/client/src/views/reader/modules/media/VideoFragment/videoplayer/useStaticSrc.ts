import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { buildStaticVideoSrc } from "../helpers";
import { useForceLowResVideo } from "../../hooks";
import { useMemo } from "react";

export const useStaticVideoSrc = (
    media: BinderVisual,
    viewportDims: IDims,
): string => {
    const forceLowResVideo = useForceLowResVideo();
    return useMemo(() => {
        try {
            return buildStaticVideoSrc(media, viewportDims, forceLowResVideo);
        } catch (e) {
            return "";
        }
    }, [media, viewportDims, forceLowResVideo]);
}

export const useStaticVideoSrcError = (
    media: BinderVisual,
    viewportDims: IDims,
): Error | null => {
    const forceLowResVideo = useForceLowResVideo();
    return useMemo(() => {
        try {
            buildStaticVideoSrc(media, viewportDims, forceLowResVideo);
            return null;
        } catch (e) {
            return e;
        }
    }, [media, viewportDims, forceLowResVideo]);
}