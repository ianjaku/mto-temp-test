import * as React from "react";
import {
    IDims,
    IVisualFormatSpec,
    VisualKind
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    getImageSourceBestFit,
    getVideoSourceBestFit
} from "@binders/client/lib/clients/imageservice/v1/util";
import { useBinderVisualSettingsByChunk, useBinderVisualTrim } from "../binder-media-store";
import { useMemo, useState } from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ImageEditView } from "./ImageEditView";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { SetStateBinderFn } from "../../documents/Composer/hooks/useStateBinder";
import Settings from "@binders/ui-kit/lib/elements/icons/Settings/index";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { VideoEditView } from "./VideoEditView";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualSettings } from "./VisualSettings";
import { buildTokenUrl } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import cx from "classnames";
import { useAutoOpenSettings } from "./hooks/useAutoOpenOnWideScreen";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./VisualEditModal.styl";

export type VisualEditModalProps = {
    visual: BinderVisual & IThumbnail;
}

export const VisualEditModal: React.FC<{
    binder: Binder;
    visual: BinderVisual & IThumbnail;
    chunkIdx: number;
    visualIdx: number;
    setStateBinder: SetStateBinderFn;
}> = ({ binder, chunkIdx, visual: apiVisual, visualIdx, setStateBinder }) => {
    // The title visual is a Thumbnail, so with this we ensure it will have the right methods
    const visual: Visual & BinderVisual & IThumbnail = useMemo(() => Object.assign(Object.create(Visual.prototype), apiVisual), [apiVisual]);
    const binderVisualTrim = useBinderVisualTrim(chunkIdx, visualIdx);
    const { t } = useTranslation();
    const [areSettingsOpen, setAreSettingsOpen] = useState(false);
    useAutoOpenSettings(areSettingsOpen, setAreSettingsOpen);

    const viewport = useMemo(() => calculateAllowedViewport({ height: window.innerHeight, width: window.innerWidth }), []);

    const isImage = visual.kind === VisualKind.IMAGE || visual.id?.startsWith("img-");
    const isVideo = visual.kind === VisualKind.VIDEO || visual.id?.startsWith("vid-");

    const getVisualSourceBestFit = isImage ? getImageSourceBestFit : getVideoSourceBestFit;

    const bestFitFormat = useMemo((): IVisualFormatSpec => {
        if (!visual.formatUrls) {
            return { ...viewport, url: buildTokenUrl(visual.medium, visual.urlToken), isVideo: true };
        }
        try {
            const bestFitVisual = getVisualSourceBestFit({
                formats: visual.formatUrls,
                isFit: true,
                isLandscape: visual.getAspectRatio() >= 1,
                viewportDims: viewport,
                fallbackToScreenshot: true,
            });
            return { ...bestFitVisual, url: buildTokenUrl(bestFitVisual.url, visual.urlToken) };
        } catch (e) {
            return { width: 0, height: 0, url: undefined, isVideo: false };
        }
    }, [getVisualSourceBestFit, visual, viewport]);

    const isScreenshot = !isImage && !bestFitFormat.isVideo;

    const storeVisualSettings = useBinderVisualSettingsByChunk(chunkIdx, visualIdx);
    const isVideoTrimmingFeatureEnabled = useLaunchDarklyFlagValue<boolean>(LDFlags.VIDEO_TRIMMING);

    const screenshotUrl = useMemo(() => {
        if (!visual.isVideo) {
            return undefined;
        }
        const videoScreenshotUrl = visual.getVideoScreenshotUrl();
        return videoScreenshotUrl ? buildTokenUrl(videoScreenshotUrl, visual.urlToken) : undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visual.urlToken, visual.isVideo]);

    // We only support trimming for videos processed through Bitmovin since
    // we're using a different path for storing the video assets.
    const shouldSupportTrimming = bestFitFormat.scheme === "video-v2:";

    return (
        <Modal
            title={isVideo && isVideoTrimmingFeatureEnabled ? t(TK.Visual_EditVideo): t(TK.Edit_Preview)}
            headerColor={"white"}
            classNames={"visual-edit-modal"}
            mobileViewOptions={{
                stretchX: { doStretch: true },
                stretchY: { doStretch: true, allowShrink: true, minTopGap: 0 },
                flyFromBottom: true,
            }}
            extension={
                <VisualSettings
                    binder={binder}
                    chunkIdx={chunkIdx}
                    visualId={visual.id}
                    visualIdx={visualIdx}
                    visualProps={storeVisualSettings}
                    setStateBinder={setStateBinder}
                />
            }
            showExtension={areSettingsOpen}
            onExtensionDismiss={() => setAreSettingsOpen(false)}
        >
            <div className="visual-edit-modal-body">
                {isImage || isScreenshot ?
                    <ImageEditView
                        src={bestFitFormat}
                        viewport={viewport}
                        overlayMessage={isScreenshot ? t(TK.Visual_VideoStillTranscoding) : null}
                        visualSettings={storeVisualSettings}
                    /> :
                    <VideoEditView
                        chunkIdx={chunkIdx}
                        endTimeMs={binderVisualTrim?.endTimeMs ?? visual.endTimeMs}
                        screenshotUrl={screenshotUrl}
                        shouldSupportTrimming={shouldSupportTrimming}
                        src={bestFitFormat}
                        startTimeMs={binderVisualTrim?.startTimeMs ?? visual.startTimeMs}
                        viewport={viewport}
                        visualIdx={visualIdx}
                        visualSettings={storeVisualSettings}
                    />
                }
                <SettingsToggle
                    areSettingsOpen={areSettingsOpen}
                    setAreSettingsOpen={setAreSettingsOpen}
                />
            </div>
        </Modal>
    )
}

const SettingsToggle: React.FC<{
    areSettingsOpen: boolean;
    setAreSettingsOpen: (open: boolean) => void;
}> = ({ areSettingsOpen, setAreSettingsOpen }) => {
    const { t } = useTranslation();
    return (
        <div
            className={cx("mobile-settings-toggle",{ "mobile-settings-toggle--open": areSettingsOpen })}
            onClick={() => setAreSettingsOpen(!areSettingsOpen)}
        >
            {!areSettingsOpen && <><Settings />{t(TK.General_MoreSettings)}</>}
        </div>
    );
}

const calculateAllowedViewport = (viewport: IDims): IDims => {
    const size = Math.min(viewport.width, viewport.height) * 0.55;
    if (viewport.height < viewport.width) {
        return { width: size, height: size };
    } else {
        return { width: size, height: size };
    }
}
