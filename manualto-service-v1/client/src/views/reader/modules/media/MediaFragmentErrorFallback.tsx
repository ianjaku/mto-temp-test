import * as React from "react";
import { IDims, VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { CombinedError } from "./CombinedError";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import VideoPlaceholderTranscoding from "./VideoFragment/VideoPlaceholderTranscoding";
import { isMobileDevice } from "../../../../util";
import { isStillTranscodingError } from "./VideoFragment/helpers";
import { logClientError } from "@binders/client/lib/util/clientErrors";
import { useMediaId } from "./hooks";
import { useStaticVideoSrcError } from "./VideoFragment/videoplayer/useStaticSrc";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const MediaFragmentErrorFallback: React.FC<{
    media: BinderVisual;
    error: Error;
    retry: () => void;
    viewportDims: IDims;
}> = (props) => {
    const { t } = useTranslation();
    const mediaId = useMediaId(props.media);
    const staticVideoSrcError = useStaticVideoSrcError(props.media, props.viewportDims);
    const isVideo = props.media.isVideo();
    const stillTranscodingError = React.useMemo(() => {
        if (!isVideo) return false;
        if (props.media.status !== VisualStatus.PROCESSING_BACKGROUND) return false;
        return isStillTranscodingError(new CombinedError([staticVideoSrcError, props.error]));
    }, [isVideo, props.media.status, staticVideoSrcError, props.error]);

    React.useEffect(() => {
        if (stillTranscodingError) return;

        logClientError(
            Application.READER,
            props.error,
            "Unhandled error when trying to load visual with id " + mediaId
        );
    }, [props.error, mediaId, stillTranscodingError]);

    if (stillTranscodingError) {
        return (
            <VideoPlaceholderTranscoding
                media={props.media}
                viewPort={props.viewportDims}
            />
        );
    }

    return (
        <div className="media-fallback" onClick={() => props.retry()}>
            <div className="media-fallback-bg"></div>
            <div className="media-fallback-box">
                <h1 className="media-fallback-title">
                    {props.media.isVideo() ? t(TK.Visual_VideoError) : t(TK.Visual_ImageError)}
                </h1>
                <p className="media-fallback-text">
                    {t(TK.Visual_VideoClickRetry, {
                        clickAction: isMobileDevice() ?
                            t(TK.General_Tap) :
                            t(TK.General_Click)
                    })}
                </p>
            </div>
        </div>
    );
}
