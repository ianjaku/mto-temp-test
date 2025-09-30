import {
    FEATURE_FORCE_LOWRES_VIDEO,
    FEATURE_VIDEOS_WITH_AUDIO
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { getThumbnailRenderUrl } from "./VideoFragment/helpers";
import { isAndroid } from "@binders/client/lib/util/browsers";
import { useIsAccountFeatureActive } from "../../../../stores/hooks/account-hooks";
import { useMemo } from "react";
import { useSearchParams } from "../../../../stores/hooks/router-hooks";
import { useVideoToken } from "./VideoFragment/videoplayer/auth/VideoAuthProvider";

export const useManifestUrls = (media: BinderVisual): string[] => {
    const token = useVideoToken(media.id);
    return useMemo(() => {
        return media.getManifestUrls(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [media.manifestUrls, token]);
}

export const useCanMediaPlayAudio = (media: BinderVisual): boolean => {
    const audioFeatureActive = useIsAccountFeatureActive(FEATURE_VIDEOS_WITH_AUDIO);
    return audioFeatureActive && media.audioEnabled
}

export const useMediaId = (
    media: {
        id?: string;
        url?: string;
        isVideo: () => boolean
    }
): string => {
    const isVideo = media.isVideo();
    return useMemo(() => {
        if (media.id == null && media.url == null) {
            throw new Error("Cannot find media id, because both the id and url are null");
        }
        return media.id || media.url.split("/").find(
            el => el.indexOf(isVideo ? "vid-" : "img-") === 0,
        );
    }, [media.id, media.url, isVideo]);
}

export const useForceLowResVideo = (): boolean => {
    const featureForceLowResVideoActive = useIsAccountFeatureActive(FEATURE_FORCE_LOWRES_VIDEO);
    const isOldAndroidDevice = isAndroid(navigator.userAgent, 1, 7)
    const searchParams = useSearchParams();

    return featureForceLowResVideoActive ||
        isOldAndroidDevice ||
        searchParams?.get("quality") === "lr";
}

export const useVideoPreviewUrl = (media: BinderVisual, viewportDims: IDims): string => {
    return useMemo(() => {
        const thumbnailRenderUrl = getThumbnailRenderUrl(media, viewportDims);
        // The url of video elements is often in the format "azurems://..." which we can't actually render
        // We need to instead wait for the formatUrls to be populated
        return thumbnailRenderUrl.startsWith("azurems") ? null : thumbnailRenderUrl;
    }, [media, viewportDims]);
}