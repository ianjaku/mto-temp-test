import * as React from "react";
import Modal, { ModalBodyPadding } from "@binders/ui-kit/lib/elements/modal";
import Tooltip, {
    TooltipPosition,
    showTooltipForBoundingClientRect
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { FEATURE_QR_CODE_LOGO } from "@binders/client/lib/clients/accountservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { QrCode } from "@binders/ui-kit/lib/elements/qrcode/QrCode";
import {
    RoundedCornersOnly
} from "@binders/ui-kit/lib/elements/rounded-corners-only/RoundedCornersOnly";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { getSemanticLinkToUseForSharing } from "@binders/client/lib/util/semanticLink";
import { groupSemanticLinks } from "../../documents/Composer/components/SemanticLinkManager/helpers";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useActiveAccountFeatures } from "../../accounts/hooks";
import { useDocumentIsPublic } from "../../documents/Composer/hooks/useDocumentIsPublic";
import { useSemanticLinks } from "../../documents/Composer/hooks/useSemanticLinks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./SharingModal.styl";

const QR_CODE_WIDTH = 230;
const QR_CODE_WIDTH_TABLET_AND_ABOVE = 213;
const LINK_LABEL_WIDTH = 180;
const LINK_LABEL_WIDTH_TABLET_AND_ABOVE = 250;

interface SharingModalProps {
    availableLanguages: { name: string, iso639_1: string }[];
    hasWarning: boolean;
    hide: () => void;
    initialLanguageCode?: string;
    itemId: string;
    titles: { text: string, iso639_1: string }[];
    itemType: "collection" | "document";
}

export const SharingModal: React.FC<SharingModalProps> = ({
    availableLanguages,
    hasWarning,
    hide,
    initialLanguageCode,
    itemId,
    itemType,
    titles,
}) => {
    const { t } = useTranslation();
    const copyLinkBtnRef = useRef<HTMLDivElement>(null);
    const copyLinkTooltipRef = useRef<Tooltip>(null);
    const copyImgBtnRef = useRef<CopyToClipboard>(null);
    const copyImgTooltipRef = useRef<Tooltip>(null);

    const itemIsPublic = useDocumentIsPublic(itemId)

    const languageElements = useMemo(
        () => availableLanguages.map(lang => ({
            id: lang.iso639_1,
            label: lang.name === "n/a" ?
                t(TK.Edit_ShareBtn_DefaultLanguage) :
                lang.name,
        })),
        [availableLanguages, t]
    );
    const selectedLanguageCode = useMemo(
        () => initialLanguageCode || languageElements[0]?.id,
        [initialLanguageCode, languageElements]
    );
    const [selectedLanguageElement, setSelectedLanguageElement] = useState<{ id: string, label: string }>();

    useEffect(() => {
        if (selectedLanguageElement) return;
        setSelectedLanguageElement(languageElements.find(lang => lang.id === selectedLanguageCode));
    }, [languageElements, selectedLanguageCode, selectedLanguageElement]);

    const semanticLinks = useSemanticLinks({ excludeDeleted: true });
    const semanticLinksMap = useMemo(
        () => semanticLinks ? groupSemanticLinks(semanticLinks) : null,
        [semanticLinks]
    );
    const [selectedSemanticLinkElement, setSelectedSemanticLinkElement] = useState<{ id: string, label: string } | null>(null);

    const semanticLinkElements = useMemo(() => {
        if (!semanticLinksMap || !selectedLanguageElement) return [];
        const links = semanticLinksMap[selectedLanguageElement.id] || [];
        return links.map(link => ({ id: link.id, label: `${link.domain}/${link.semanticId}` }));
    }, [selectedLanguageElement, semanticLinksMap]);

    useEffect(() => {
        if (!semanticLinksMap || !selectedLanguageElement) return;
        if (selectedSemanticLinkElement) return;
        const links = semanticLinksMap[selectedLanguageElement.id] || [];
        if (links.length) {
            const link = getSemanticLinkToUseForSharing(links);
            setSelectedSemanticLinkElement({ id: link.id, label: `${link.domain}/${link.semanticId}` });
        }
    }, [selectedLanguageElement, selectedSemanticLinkElement, semanticLinksMap]);

    const features = useActiveAccountFeatures();
    const isMobile = isMobileView();
    const qrCodeWidth = useMemo(
        () => isMobile ?
            QR_CODE_WIDTH :
            QR_CODE_WIDTH_TABLET_AND_ABOVE,
        [isMobile]
    );

    const activeLanguageCode = selectedLanguageElement?.id || selectedLanguageCode;
    const title = useMemo(() => {
        const matchingTitle = titles.find(title => title.iso639_1 === activeLanguageCode);
        return matchingTitle?.text ?? "";
    }, [titles, activeLanguageCode]);

    const qrFileName = useMemo(() => {
        if (!title) return "qrcode.png";
        const cleaned = (title || "").trim().replace(/\s+/g, " "); // Trim & normalize multiple spaces into single spaces
        const safe = cleaned.replace(/[^\w -._]/g, ""); // Remove all but alphanumeric, spaces, dashes, underscores, and periods
        const underscored = safe.replace(/[ ]+/g, "_"); // Replace spaces with underscores
        return underscored.length ? `qrcode-${underscored}.png` : "qrcode.png";
    }, [title]);

    const [downloadableImage, setDownloadableImage] = React.useState<string>();
    const [copyableBlob, setCopyableBlob] = React.useState<Blob>();
    const accessMessage = useMemo(() => {
        if (itemType === "document") {
            return itemIsPublic ? t(TK.Reader_Sharing_AccessPublic_Document) : t(TK.Reader_Sharing_AccessRestricted_Document);
        }
        return itemIsPublic ? t(TK.Reader_Sharing_AccessPublic_Collection) : t(TK.Reader_Sharing_AccessRestricted_Collection);
    }, [itemIsPublic, itemType, t]);

    const shareTitle = title.length ? `"${title}"` : "";

    return (
        <Modal
            onHide={hide}
            withoutHeader
            closeIcon={<Icon name="close" />}
            modalBodyPadding={isMobile ? ModalBodyPadding.Default : ModalBodyPadding.Medium}
            mobileViewOptions={{
                stretchX: { doStretch: true },
                stretchY: { doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 150 },
                flyFromBottom: true,
            }}
        >
            <div className="composer-share-modal">
                <div className="composer-share-modal-header">
                    <label className="composer-share-modal-header-title">
                        {`${t(TK.Reader_Sharing_ShareDoc)} ${shareTitle}`}
                    </label>
                </div>
                <div className="composer-share-modal-body">

                    {hasWarning && (
                        <div className="composer-share-modal-disabled-share">
                            <Icon name="info" />
                            <span>
                                {itemType === "document" ?
                                    t(TK.Sharing_Document_NoActivePublication) :
                                    t(TK.Sharing_Collection_NoActivePublications)}
                            </span>
                        </div>
                    )}

                    {selectedSemanticLinkElement && (
                        <div className="composer-share-modal-row">
                            <label className="composer-share-modal-row-label">
                                {t(TK.General_Language)}
                            </label>
                            <Dropdown
                                type="language"
                                elements={languageElements}
                                selectedElementId={selectedLanguageElement?.id}
                                onSelectElement={(id) => {
                                    setSelectedLanguageElement(languageElements.find(lang => lang.id === id));
                                    setSelectedSemanticLinkElement(null);
                                }}
                                variant="outlined"
                                data-testid="composer-share-modal-languageDropdown"
                            />
                        </div>
                    )}

                    {selectedSemanticLinkElement && (
                        <div
                            className="composer-share-modal-row"
                            key={semanticLinkElements.map(e => e.id).join(",")}
                        >
                            <label className="composer-share-modal-row-label">
                                {t(TK.General_Link)}
                            </label>
                            <Dropdown
                                type="semanticLink"
                                elements={semanticLinkElements}
                                selectedElementId={selectedSemanticLinkElement.id}
                                onSelectElement={(id) => {
                                    setSelectedSemanticLinkElement(semanticLinkElements.find(link => link.id === id))
                                }}
                                variant="outlined"
                                maxWidthLabel={isMobile ? LINK_LABEL_WIDTH : LINK_LABEL_WIDTH_TABLET_AND_ABOVE}
                                data-testid="composer-share-modal-linkDropdown"
                            />
                            <div
                                ref={copyLinkBtnRef}
                                className="composer-share-modal-row-copyLink"
                                data-testid="composer-share-modal-copyLink"
                            >
                                <CopyToClipboard
                                    text={"https://" + selectedSemanticLinkElement.label}
                                    onCopy={(_txt, success) => {
                                        if (success) {
                                            showTooltipForBoundingClientRect(
                                                copyLinkBtnRef.current.getBoundingClientRect(),
                                                copyLinkTooltipRef.current,
                                                TooltipPosition.TOP,
                                                { top: 7, left: -66 }
                                            );
                                        }
                                    }}
                                >
                                    <label>
                                        <Icon name="content_copy" />
                                    </label>
                                </CopyToClipboard>
                            </div>
                            <Tooltip
                                ref={copyLinkTooltipRef}
                                message={t(TK.Reader_Sharing_LinkCopied)}
                                arrowOnBottom
                            />
                        </div>
                    )}

                    {selectedSemanticLinkElement && (
                        <div className={cx("composer-share-modal-row", "composer-share-modal-row--vAlignTop")}>
                            <label className="composer-share-modal-row-label">
                                {t(TK.General_QrCode)}
                            </label>
                            <div className="composer-share-modal-qrCode">
                                <RoundedCornersOnly>
                                    <QrCode
                                        link={`https://${selectedSemanticLinkElement.label}`}
                                        useLogo={features.includes(FEATURE_QR_CODE_LOGO)}
                                        canvasMaxWidth={qrCodeWidth}
                                        style={{
                                            padding: isMobile ? `${qrCodeWidth * .05}px` : `${qrCodeWidth * .1}px`,
                                        }}
                                        setDownloadableImage={setDownloadableImage}
                                        setCopyableBlob={setCopyableBlob}
                                    />
                                </RoundedCornersOnly>
                                <div className="composer-share-modal-qrCode-actions">
                                    {downloadableImage && (
                                        <Button
                                            secondary
                                            text={t(TK.General_Download)}
                                            hrefAnchor={downloadableImage}
                                            downloadableName={qrFileName}
                                        />
                                    )}
                                    {copyableBlob && (
                                        <div ref={copyImgBtnRef}>
                                            <Button secondary text={t(TK.General_Copy)} onClick={() => {
                                                navigator.clipboard.write([new ClipboardItem({ "image/png": copyableBlob })]);
                                                showTooltipForBoundingClientRect(
                                                    copyImgBtnRef.current.getBoundingClientRect(),
                                                    copyImgTooltipRef.current,
                                                    TooltipPosition.TOP,
                                                    { top: 6, left: -56 }
                                                );
                                            }} />
                                            <Tooltip
                                                ref={copyImgTooltipRef}
                                                message={t(TK.Reader_Sharing_QrImgCopied)}
                                                arrowOnBottom
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedSemanticLinkElement && (
                        <div className="composer-share-modal-row">
                            <label className="composer-share-modal-row-label">
                                {t(TK.General_Visibility)}
                            </label>
                            <div>
                                {accessMessage}
                            </div>
                        </div>
                    )}

                </div>
                <div className="composer-share-modal-footer">
                    <Button CTA text={t(TK.General_Close)} onClick={() => hide()} data-testid="composer-share-modal-close" />
                </div>
            </div>
        </Modal>
    )
}

