import * as React from "react";
import { getImageSourceBestFit, getVideoSourceBestFit } from "@binders/client/lib/clients/imageservice/v1/util";
import { IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ImageView } from "./ImageView";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { VideoView } from "./VideoView";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualKind } from "@binders/client/lib/clients/imageservice/v1/contract";
import { buildTokenUrl } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { isVideoTranscodingFinished } from "@binders/client/lib/clients/imageservice/v1/util";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./VisualView.styl";

export const enum Orientation {
    Landscape,
    Portrait,
}

export type VisualViewProps = {
    visual: Visual & IThumbnail;
}

export const VisualView: React.FC<VisualViewProps> = ({ visual }) => {
    const { bgColor, rotation } = visual || {};
    const { t } = useTranslation();

    const viewport = useMemo(() => ({
        height: window.innerHeight * 0.8,
        width: window.innerWidth * 0.8,
    }), []);

    const isImage = visual.kind === VisualKind.IMAGE || visual.id?.startsWith("img-");

    const getVisualSourceBestFit = isImage ? getImageSourceBestFit : getVideoSourceBestFit;

    const bestFitFormat = useMemo(() => {
        if (!visual.formatUrls) {
            return { ...viewport, url: buildTokenUrl(visual.medium, visual.urlToken), isVideo: true };
        }
        const orientation = visual.getAspectRatio() >= 1 ?
            Orientation.Landscape :
            Orientation.Portrait;
        try {
            const bestFitSrc = getVisualSourceBestFit({
                formats: visual.formatUrls,
                isFit: true,
                isLandscape: orientation === Orientation.Landscape,
                viewportDims: viewport,
                fallbackToScreenshot: true,
            });
            return { ...bestFitSrc, url: buildTokenUrl(bestFitSrc.url, visual.urlToken) };
        }
        catch (e) {
            return { width: 0, height: 0, url: undefined, isVideo: false };
        }
    }, [getVisualSourceBestFit, visual, viewport]);

    const isScreenshot = !isImage && !bestFitFormat.isVideo;
    const isTranscodingFinished = useMemo(() => {
        return visual.isVideo() && isVideoTranscodingFinished(visual.formatUrls);
    }, [visual]);

    return isImage || isScreenshot ?
        <ImageView
            bgColor={bgColor}
            rotation={rotation}
            src={bestFitFormat}
            viewport={viewport}
            overlayMessage={isScreenshot ? t(TK.Visual_VideoStillTranscoding) : null}
        /> :
        <VideoView
            audioEnabled={visual.audioEnabled}
            bgColor={bgColor}
            rotation={0}
            src={bestFitFormat}
            viewport={viewport}
            overlayMessage={isTranscodingFinished || bestFitFormat ? null : t(TK.Visual_VideoStillTranscoding)}
        />;
}
