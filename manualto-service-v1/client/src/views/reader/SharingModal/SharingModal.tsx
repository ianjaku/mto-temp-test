import * as React from "react";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import Tooltip, {
    TooltipPosition,
    showTooltipForBoundingClientRect
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { buildLink, generateDocumentLink } from "@binders/client/lib/binders/readerPath";
import { useActiveViewable, useIsPublicViewable } from "../../../stores/hooks/binder-hooks";
import { useMemo, useRef } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { FEATURE_QR_CODE_LOGO } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ModalComponent } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { QrCode } from "@binders/ui-kit/lib/elements/qrcode/QrCode";
import ReaderModal from "../../components/ReaderModal/ReaderModal";
import {
    RoundedCornersOnly
} from "@binders/ui-kit/lib/elements/rounded-corners-only/RoundedCornersOnly";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getReaderDomain } from "../../../util";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { getSemanticLinkToUseForSharing } from "@binders/client/lib/util/semanticLink";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useActiveAccountFeatures } from "../../../stores/hooks/account-hooks";
import { useInterfaceLanguage } from "../../../helpers/hooks/useInterfaceLanguage";
import { useMachineTranslatedText } from "../../../utils/hooks/useMachineTranslatedText";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./SharingModal.styl";

export const SHARING_MODAL_ID = "sharingModal";
const TITLE_CUTOFF = 80;
const QR_CODE_WIDTH = 200;
const QR_CODE_WIDTH_TABLET_AND_ABOVE = 213;


interface SharingModalProps {
    semanticLinks: ISemanticLink[];
    languageCode?: string;
    machineTranslatedLanguageCode?: string;
    translatedTitle?: string;
}

export const SharingModal: ModalComponent<SharingModalProps> = ({ params, hide }) => {

    const tooltipRef = useRef(null);
    const copyBtnRef = useRef(null);
    const features = useActiveAccountFeatures();
    // note: SharingModal only gets rendered when the viewable is a publication
    const publication = useActiveViewable() as Publication;
    const domain = getReaderDomain();

    const isPublicViewable = useIsPublicViewable();

    const qrCodeWidth = useMemo(
        () => isMobileView() ?
            QR_CODE_WIDTH :
            QR_CODE_WIDTH_TABLET_AND_ABOVE,
        []
    );

    const url = useMemo(() => {
        if (!publication) {
            return "";
        }
        if (!params.semanticLinks.length) {
            return buildLink({
                isCollection: false,
                itemId: publication.binderId,
                domain,
                lang: params.languageCode,
                machineTranslatedLanguageCode: params.machineTranslatedLanguageCode,
                readerLocation: getReaderLocation(domain),
            })
        }
        const semanticLink = getSemanticLinkToUseForSharing(params.semanticLinks, params.languageCode);
        return generateDocumentLink(semanticLink, { machineTranslatedLanguageCode: params.machineTranslatedLanguageCode });
    }, [domain, params.languageCode, publication, params.machineTranslatedLanguageCode, params.semanticLinks]);

    const { t } = useTranslation();

    const titleToRender = useMemo(() => {
        if (!publication) {
            return "";
        }
        const title = params.translatedTitle ?? publication.language?.storyTitle;
        return title.length > TITLE_CUTOFF ? `${title.slice(0, TITLE_CUTOFF)}...` : title;
    }, [publication, params.translatedTitle]);

    const [accessMsg, accessIconName] = useMemo(() => {
        if (isPublicViewable === undefined) {
            return [undefined, undefined];
        }
        return isPublicViewable ?
            [t(TK.Reader_Sharing_AccessPublic_Document), "visibility_outline"] :
            [t(TK.Reader_Sharing_AccessRestricted_Document), "visibility_off_outline"];
    }, [isPublicViewable, t]);

    const showMachineTranslatedDocumentDisclaimer = !!params.machineTranslatedLanguageCode;

    const disclaimer = t(TK.Reader_Sharing_Disclaimer);
    const interfaceLanguage = useInterfaceLanguage();
    const translatedDisclaimer = useMachineTranslatedText({
        sourceLanguageCode: interfaceLanguage,
        targetLanguageCode: params.machineTranslatedLanguageCode,
        text: disclaimer,
    });

    return (
        <ReaderModal
            onRequestHide={() => {
                captureFrontendEvent(ReaderEvent.ReaderSharingModalClickedOutside);
                hide();
            }}
        >
            <div className="sharingModal">
                <div className="sharingModal-header">
                    <label className="sharingModal-header-shareLbl">{t(TK.Reader_Sharing_ShareDoc)}</label>
                    <label
                        className="sharingModal-header-docTitle"
                        style={{
                            maxWidth: `${qrCodeWidth * 1.25}px`,
                        }}
                    >
                        {titleToRender}
                    </label>
                </div>
                {showMachineTranslatedDocumentDisclaimer && <div className="sharingModal-mtDisclaimer">
                    <Icon name="info" />
                    <span>
                        <span>{disclaimer}</span>
                        <span> &ndash; </span>
                        <span>{translatedDisclaimer.data}</span>
                    </span>
                </div>}
                <RoundedCornersOnly>
                    <QrCode
                        link={url}
                        useLogo={features.includes(FEATURE_QR_CODE_LOGO)}
                        canvasMaxWidth={qrCodeWidth}
                        style={{
                            padding: `${qrCodeWidth * .1}px`,
                        }}
                    />
                </RoundedCornersOnly>
                <div className="sharingModal-restrictedAccessMsg">
                    {accessMsg && (
                        <>
                            <Icon name={accessIconName} />
                            <label className="sharingModal-restrictedAccessMsg-lbl">
                                {accessMsg}
                            </label>
                        </>
                    )}
                </div>
                <div className="sharingModal-buttons">
                    <div ref={copyBtnRef}>
                        <CopyToClipboard
                            text={url}
                            onCopy={(_txt, success) => {
                                if (success) {
                                    captureFrontendEvent(ReaderEvent.ReaderSharingCopyLinkButtonClicked);
                                    showTooltipForBoundingClientRect(
                                        copyBtnRef.current.getBoundingClientRect(),
                                        tooltipRef.current,
                                        TooltipPosition.TOP,
                                        { top: 14, left: -3 }
                                    );
                                }
                            }}
                        >
                            <Button
                                text={t(TK.General_CopyLink)}
                                onClick={() => { /* handled by CopyToClipboard */ }}
                                secondary={true}
                            />
                        </CopyToClipboard>
                    </div>
                    <Button
                        text={t(TK.General_Close)}
                        onClick={() => {
                            hide();
                            captureFrontendEvent(ReaderEvent.ReaderSharingCloseButtonClicked);
                        }}
                        CTA={true}
                    />
                </div>
                <Tooltip
                    ref={tooltipRef}
                    message={t(TK.Reader_Sharing_LinkCopied)}
                    arrowOnBottom
                />
            </div>
        </ReaderModal>
    );
};
