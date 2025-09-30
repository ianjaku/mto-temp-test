import {
    FEATURE_DOCUMENT_OWNER,
    FEATURE_DOWNLOAD_PDF_FROM_READER
} from "@binders/client/lib/clients/accountservice/v1/contract";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { SHARING_MODAL_ID, SharingModal } from "../../SharingModal/SharingModal";
import { getHightlightLeftPosition, getSubToolbarWidth } from "../helpers";
import { isFeedbackEl, isManualToEl } from "../../modules/text/utils";
import { useActiveViewable, useCommentsEnabled } from "../../../../stores/hooks/binder-hooks";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { ToolbarTooltip } from "../ToolbarTooltip";
import { UserOwner } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import cx from "classnames";
import { isPreviewPath } from "../../../../util";
import { isPublicationItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import manualtoVars from "../../../../vars.json";
import tokenStore from "@binders/client/lib/clients/tokenstore";
import { useActiveChunkElement } from "../../../../stores/zustand/text-module-store";
import { useActiveSemanticLinks } from "../../../../stores/hooks/routing-hooks";
import { useIsAccountFeatureActive } from "../../../../stores/hooks/account-hooks";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useOwnershipForItem } from "../../../../binders/hooks";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";


interface Props {
    activeLanguageCode: string;
    translatedLanguage?: string;
    translatedTitle?: string;
    onClickDownloadPdfButton: () => Promise<void>;
    toggleCommentsSidebar: () => void;
    invisible?: boolean;
}

export const ToolbarActions: React.FC<Props> = (props) => {

    const { t } = useTranslation();

    const activeChunkEl = useActiveChunkElement();
    const commentsEnabled = useCommentsEnabled();
    const semanticLinksResult = useActiveSemanticLinks();
    const activeViewable = useActiveViewable();
    const [owners, setOwners] = useState<UserOwner[]>([]);
    const [ownerInfoVisible, setOwnerInfoVisible] = useState(false);
    const ref = useOutsideClick<HTMLDivElement>(() => setOwnerInfoVisible(false));

    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

    const { data: binderOwnership } = useOwnershipForItem(isPublicationItem(activeViewable) ? activeViewable.binderId : null);

    useEffect(() => {
        // query was called with expandGroups so we can safely assume the owners are UserOwners
        setOwners(binderOwnership?.owners as UserOwner[] || []);
    }, [binderOwnership, setOwners]);

    const shouldDisplayCommentsBtn = useMemo(() => {
        if (!activeChunkEl || isManualToEl(activeChunkEl) || isFeedbackEl(activeChunkEl)) {
            return false;
        }
        return commentsEnabled && !props.translatedLanguage;
    }, [activeChunkEl, commentsEnabled, props.translatedLanguage]);

    const shouldDisplayDownloadPdfBtn = useIsAccountFeatureActive(FEATURE_DOWNLOAD_PDF_FROM_READER);
    const isReaderShareModalFlagSet = useLaunchDarklyFlagValue<boolean>(LDFlags.READER_SHARE_MODAL);
    const shouldDisplayShareBtn =
        !isPreviewPath(window.location.pathname) &&
        isReaderShareModalFlagSet &&
        semanticLinksResult?.data;
    const shouldDisplayOwnerInfoBtn =
        useIsAccountFeatureActive(FEATURE_DOCUMENT_OWNER) &&
        !tokenStore.isPublic() &&
        owners.length > 0;

    const showSharingModal = useShowModal(SharingModal, SHARING_MODAL_ID);

    const [hoveredButtonIndex, setHoveredButtonIndex] = useState<number | null>(null);

    const [buttonIdLoading, setButtonIdLoading] = useState<string | null>(null);

    const buttonDefs = useMemo(() => {
        return [
            ...(shouldDisplayOwnerInfoBtn ?
                [{
                    id: "owners",
                    onClick: () => {
                        setOwnerInfoVisible(!ownerInfoVisible);
                        setVisibleTooltip(null);
                    },
                    icon: <Icon name="person" />,
                    tooltip: t(TK.Reader_DocumentOwners_Tooltip),
                    unresponsive: ownerInfoVisible
                }] :
                []),
            ...(shouldDisplayDownloadPdfBtn ?
                [{
                    id: "downloadpdf",
                    onClick: async () => {
                        setButtonIdLoading("downloadpdf");
                        await props.onClickDownloadPdfButton();
                        setButtonIdLoading(null);
                    },
                    icon: <Icon name="file_download" outlined />,
                    tooltip: t(TK.Reader_PdfExport_Tooltip),
                }] :
                []),
            ...(shouldDisplayCommentsBtn ?
                [{
                    id: "comments",
                    onClick: props.toggleCommentsSidebar,
                    icon: <Icon name="comment" />,
                    tooltip: t(TK.Reader_Comments_Tooltip),
                    className: "mr-[2px]"
                }] :
                []),
            ...(shouldDisplayShareBtn ?
                [{
                    id: "share",
                    onClick: () => {
                        showSharingModal({
                            semanticLinks: semanticLinksResult.data,
                            languageCode: props.activeLanguageCode,
                            machineTranslatedLanguageCode: props.translatedLanguage,
                            translatedTitle: props.translatedTitle,
                        });
                        captureFrontendEvent(ReaderEvent.ReaderSharingToolbarButtonClicked);
                    },
                    icon: <Icon name="share" style={{ position: "relative", right: "2px" }} />,
                    tooltip: t(TK.Reader_Sharing_Tooltip),
                }] :
                []),
        ];
    }, [ownerInfoVisible, props, semanticLinksResult?.data, shouldDisplayCommentsBtn, shouldDisplayDownloadPdfBtn, shouldDisplayOwnerInfoBtn, shouldDisplayShareBtn, showSharingModal, t]);

    const btnCount = buttonDefs.length;
    const width = props.invisible ? 0 : getSubToolbarWidth(btnCount);

    if (!btnCount) {
        return null;
    }

    return (
        <div
            className={cx("toolbarPill toolbarActions", { "toolbarActions--invisible": props.invisible })}
            style={{ width, marginLeft: !!width && manualtoVars.toolbarGap }}
            ref={ref}
        >
            {hoveredButtonIndex !== null && (
                <div
                    className="toolbarActions-highlight"
                    style={
                        (hoveredButtonIndex === btnCount - 1) ?
                            { right: 0 } :
                            { left: getHightlightLeftPosition(hoveredButtonIndex) }
                    }
                ></div>
            )}
            <div className="toolbarSpacer"></div>
            <div className={cx(
                "toolbarButtons",
                buttonDefs.length === 1 ? "justify-center" : "justify-between",
            )}>
                {buttonDefs.map((btnDef, index) => {
                    return (
                        <Fragment key={`tba-btn${index}`}>
                            <div
                                onClick={() => {
                                    if (buttonIdLoading === btnDef.id) return;
                                    btnDef.onClick();
                                }}
                                className={cx(
                                    "toolbarButtons-button",
                                    btnDef.unresponsive ? "pointer-events-none" : "pointer-events-auto",
                                    btnDef.className,
                                )}
                                onMouseEnter={() => { setHoveredButtonIndex(index); setVisibleTooltip(btnDef.id); }}
                                onMouseLeave={() => { setHoveredButtonIndex(null); setVisibleTooltip(null); }}
                            >
                                {buttonIdLoading === btnDef.id ?
                                    circularProgress(undefined, undefined, undefined, vars.baseColor) :
                                    btnDef.icon
                                }
                            </div>
                            {visibleTooltip === btnDef.id && (
                                <ToolbarTooltip
                                    message={btnDef.tooltip}
                                    rightAnchor
                                />
                            )}
                        </Fragment>
                    )
                })}
            </div>
            {ownerInfoVisible && (
                <div className="toolbarActions-ownerInfo">
                    <label className="toolbarActions-ownerInfo-title">
                        {t(TK.DocOwners_Owners)}:
                    </label>
                    {owners.map((owner, index) => (
                        <div className="toolbarActions-ownerInfo-owner" key={`ownr${index}`}>
                            <label className="toolbarActions-ownerInfo-owner-name">
                                {owner.name}
                            </label>
                            <label className="toolbarActions-ownerInfo-owner-login">
                                {owner.login}
                            </label>
                        </div>
                    ))}
                </div>
            )}
            <div className="toolbarSpacer"></div>
        </div>
    )
}
