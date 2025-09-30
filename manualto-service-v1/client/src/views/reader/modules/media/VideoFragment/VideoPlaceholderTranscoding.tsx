import * as React from "react";
import LazyImage from "../../../../components/LazyImage";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { getFitBehaviour } from "../visualHelpers";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./videoPlaceholderTranscoding.styl";

const VideoPlaceholderTranscoding = ({ media, viewPort }) => {
    const { t } = useTranslation();

    const screenshotUrl = React.useMemo(
        () => media.getVideoScreenshotUrl && media.getVideoScreenshotUrl(),
        [media]
    );

    return (
        <div className="video-placeholder-transcoding">
            <label className="video-placeholder-transcoding-label">{ t(TranslationKeys.Visual_VideoStillTranscoding)}</label>
            <div className="video-placeholder-transcoding-backdrop" style={{
                ...(!screenshotUrl && {
                    background: "radial-gradient(#505050, #3c3c3c)"
                })
            }}>
                {screenshotUrl && <LazyImage
                    alt={screenshotUrl}
                    src={screenshotUrl}
                    fillDimension={media.getFillDimension({ width: viewPort.width, height: viewPort.height })}
                    fitBehaviour={getFitBehaviour(media)}
                    isCarouselImage={false}
                />}
            </div>
        </div>
    );
};

export default VideoPlaceholderTranscoding;