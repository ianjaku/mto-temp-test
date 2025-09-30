import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { NoVideoFormatsError } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { useManifestUrls } from "../../hooks";
import { useMemo } from "react";
import { useStaticVideoSrc } from "./useStaticSrc";

const streamingUrlToType = (url: string): string => {
    // HLS
    if (url.match(/format=m3u8/) !== null) {
        return "application/x-mpegURL"
    }
    if (url.includes(".m3u8")) {
        return "application/vnd.apple.mpegurl"
    }
    if (url.toLowerCase().includes("/hlsproxy/")) {
        return "application/vnd.apple.mpegurl"
    }
    // DASH
    if (url.match(/format=mpd/) !== null) {
        return "application/dash+xml"
    }
    if (url.includes(".mpd")) {
        return "application/dash+xml"
    }
    // Azure media player
    return "application/vnd.ms-sstr+xml";
}

export function useSources(media: BinderVisual, imageViewportDims: IDims) {
    const manifestUrls = useManifestUrls(media);

    const manifestSources = useMemo(() => {
        if (!manifestUrls) return [];
        return manifestUrls.map(manifestUrl => ({
            src: manifestUrl,
            type: streamingUrlToType(manifestUrl),
        }));
    }, [manifestUrls]);

    const staticSrc = useStaticVideoSrc(media, imageViewportDims);
    const allSources = useMemo(() => {
        if (!staticSrc) return manifestSources;
        return [...manifestSources, {
            src: staticSrc,
            type: "video/mp4"
        }];
    }, [manifestSources, staticSrc]);

    if (allSources.length === 0) {
        throw new NoVideoFormatsError();
    }

    return allSources;
}
