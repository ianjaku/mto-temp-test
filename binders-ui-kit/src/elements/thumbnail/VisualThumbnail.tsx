import * as React from "react";
import { Image, Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import Thumbnail, { IThumbnailProps } from ".";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import Loader from "../loader";
import { useEffect } from "react";

interface IVisualThumbnailProps extends IThumbnailProps {
    visual: Visual | BinderVisual | Image;
    onRetryThumbnail?: () => void;
}

const getVisualUrl = (
    visual: BinderVisual | Image | Visual,
    options?: { ignoreStartTime?: boolean }
): string | null => {
    if ("buildRenderUrl" in visual && visual.buildRenderUrl) {
        return visual.buildRenderUrl({
            requestedFormatNames: ["medium"],
            timeMs: options?.ignoreStartTime ?
                undefined :
                visual.startTimeMs || undefined
        });
    }
    if ("url" in visual && visual.url) {
        return visual.url;
    }
    if ("urls" in visual && visual.urls) {
        return (visual.urls as Record<string, string>).medium;
    }
    return null;
};

const _visualsRetried = {};
const useEnsureThumbnail = (
    visual: Visual | BinderVisual | Image,
    src: string | null,
    onRetryThumbnail?: () => void
) => {
    useEffect(() => {
        if (!onRetryThumbnail) return undefined;
        if (
            "startTimeMs" in visual &&
            visual.startTimeMs > 0 &&
            src == null &&
            !_visualsRetried[visual.id]
        ) {
            const timeout = setTimeout(() => {
                if (_visualsRetried[visual.id]) return;
                _visualsRetried[visual.id] = true;
                onRetryThumbnail?.();
            }, 1000 * 10);
            return () => clearTimeout(timeout);
        }
        return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visual, src]) ;
}

const VisualThumbnail: React.FC<IVisualThumbnailProps> = (props) => {
    const visualUrl = getVisualUrl(props.visual);
    useEnsureThumbnail(props.visual, visualUrl, props.onRetryThumbnail);
    const hasNonZeroStartTime = "startTimeMs" in props.visual && !!props.visual.startTimeMs && props.visual.startTimeMs > 0;
    return !visualUrl && hasNonZeroStartTime ?
        <Thumbnail
            {...props}
            src={getVisualUrl(props.visual, { ignoreStartTime: true })}
            centralFloatingElement={
                <div className="thumbnail-loading-overlay" onClick={props.onClick} onDoubleClick={props.onDoubleClick}>
                    <Loader className="thumbnail-loader" textEnabled={false}/>
                </div>
            }
        /> :
        <Thumbnail {...props} src={visualUrl}/>
};

export default VisualThumbnail;
