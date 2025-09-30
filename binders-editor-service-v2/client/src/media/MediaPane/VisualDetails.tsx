import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { downloadVisual, getDownloadOriginalUrl } from "../helper";
import CompareArrows from "@binders/ui-kit/lib/elements/icons/CompareArrows";
import { ComposerContext } from "../../documents/Composer/contexts/composerContext";
import Delete from "@binders/ui-kit/lib/elements/icons/Lock";
import FileDownload from "@binders/ui-kit/lib/elements/icons/FileDownload";
import Lock from "@binders/ui-kit/lib/elements/icons/Lock";
import { StoreVisual } from "../binder-media-store";
import { TK } from "@binders/client/lib/react/i18n/translations";
import ZoomOutMap from "@binders/ui-kit/lib/elements/icons/ZoomOutMap";
import classNames from "classnames";
import cx from "classnames";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./MediaPane.styl";

type Props = {
    imageModuleKey?: string;
    onDeleteVisual: (visualId: string) => void;
    onReplaceVisual: (visual: StoreVisual) => void;
    onUpdateVisual?: (visualId: string, imageModuleKey: string, updates: Record<string, unknown>) => void;
    onVisualViewLarge?: (visual: StoreVisual) => void;
    visual: StoreVisual;
};

export const VisualDetails = ({
    visual,
    onDeleteVisual,
    onReplaceVisual,
    onVisualViewLarge,
}: Props) => {

    const { t } = useTranslation();

    const handleDelete = () => {
        onDeleteVisual(visual.id);
    };

    const handleReplace = () => {
        onReplaceVisual(visual);
        captureFrontendEvent(EditorEvent.MediaPaneReplaceMediaItem);
    };

    const buildOnVisualViewLarge = (setVisual: (visual: StoreVisual) => void, visual: StoreVisual) => {
        return () => {
            if (onVisualViewLarge) {
                onVisualViewLarge(visual);
            }
            setVisual(visual); // used by the new composer
            captureFrontendEvent(EditorEvent.MediaPaneViewMediaItemLarge);
        };
    };

    const renderDownloadButton = (child: React.ReactNode) => {
        const inner = isIE() ?
            (
                <a onClick={() => downloadVisual(visual as Parameters<typeof downloadVisual>[0])}>
                    {child}
                </a>
            ) :
            (
                <a
                    onClick={() => captureFrontendEvent(EditorEvent.MediaPaneDownloadOriginal)}
                    href={getDownloadOriginalUrl(visual, { forceDownload: true })}
                    target="_blank"
                    rel="noreferrer"
                >
                    {child}
                </a>
            );
        return (
            <li className="visual-properties-actions-action visual-properties-actions-action-download">
                <div className="visual-properties-actions-action-download-container">
                    {inner}
                    <div className="visual-properties-actions-action-download-filler" />
                </div>
            </li>
        );
    };

    const smallIconStyle: React.CSSProperties = {
        color: "currentColor",
        fontSize: 12
    };

    const getVisualPosition = (chunkIndex: number) => chunkIndex === 0 ?
        t(TK.Visual_DocumentThumbnail) :
        t(TK.Visual_ChunkPosition, { position: chunkIndex });

    const getVisualPositions = () => {
        if (!visual.chunks) return [];
        const positions: string[] = [];
        Object.keys(visual.chunks).forEach(chunkIndex => {
            const chunkIdx = Number(chunkIndex);
            const visualIndexes = visual.chunks![chunkIdx];
            if (visualIndexes && visualIndexes.length > 0) {
                positions.push(getVisualPosition(chunkIdx));
            }
        });
        return positions;
    };

    const positions = getVisualPositions();
    const visualInUseMessage = positions.length > 0 ?
        t(
            TK.Visual_MediaItemUsedInPosition,
            {
                position: positions.length > 1 ?
                    positions.join(", ") :
                    positions[0],
                count: positions.length
            }
        ) :
        "";

    const actionClass = "visual-properties-actions-action";
    const ctaClass = classNames("visual-properties-actions-action-label", "visual-properties-actions-action-label--cta");

    return (
        <ComposerContext.Consumer>
            {context => (
                <div className="visual-properties">
                    <div className="visual-properties-disclaimer">
                        <h4>{t(TK.Visual_EditDisclaimerTitle)}</h4>
                        <p>{t(TK.Visual_EditDisclaimerDescription)}</p>
                    </div>
                    <ul className={
                        classNames("visual-properties-actions")}
                    >
                        {
                            visual.inUse && (
                                <li className={actionClass}>
                                    {Lock(smallIconStyle)}
                                    <label
                                        className={cx("visual-properties-actions-action-label", "visual-properties-actions-action-label--noclip")}
                                    >
                                        {visualInUseMessage}
                                    </label>
                                </li>
                            )
                        }
                        <li className={actionClass}>
                            {ZoomOutMap(smallIconStyle)}
                            <label className={ctaClass} onClick={buildOnVisualViewLarge(context.setOpenVisual, visual)}>
                                {t(TK.Visual_ViewMediaItem)}
                            </label>
                        </li>
                        {
                            renderDownloadButton(
                                (
                                    <span className={actionClass}>
                                        {FileDownload(smallIconStyle)}
                                        <label className={ctaClass}>
                                            {t(TK.Visual_DownloadOriginalFile, { fileName: `${visual.filename}.${visual.extension}` })}
                                        </label>
                                    </span>
                                )
                            )
                        }
                        <li className={actionClass}>
                            {CompareArrows(smallIconStyle)}
                            <label className={ctaClass} onClick={handleReplace}>
                                {t(TK.Visual_ReplaceMediaItem)}
                            </label>
                        </li>
                        {
                            !visual.inUse && (
                                <li className={actionClass}>
                                    {Delete(smallIconStyle)}
                                    <label className={ctaClass} onClick={handleDelete}>
                                        {t(TK.Visual_DeleteMediaItem)}
                                    </label>
                                </li>
                            )
                        }
                    </ul>
                </div>
            )}
        </ComposerContext.Consumer>
    );
};
