import Dropdown, { IDropdownElement } from "../dropdown";
import Button from "../button";
import ClipboardIcon from "../icons/CopyClipboard";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { QrCode } from "../qrcode/QrCode";
import React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./QrCodeAndShareLinks.styl";

export interface ShareLanguage {
    id: number;
    languageLabel: string;
    link: string;
}

interface Props {
    linkOptions?: string[];
    onLinkSelected?: (link: string) => void;
    link: string;
    languages?: ShareLanguage[];
    selectedItemId?: number;
    languageSelect?: (id: number) => void;
    showFlashMessage?: () => void;
    useLogo?: boolean;
    canvasMaxWidth?: number;
}

export const QrCodeAndShareLinks: React.FC<Props> = (props) => {

    const [downloadableImage, setDownloadableImage] = React.useState<string>();
    const { t } = useTranslation();

    const onCopyLink = (_txt, success) => {
        if (props.showFlashMessage && success) {
            props.showFlashMessage();
        }
    }

    const dropdownElements = (props.languages || []).map(language => ({
        id: language.id,
        label: language.languageLabel,
    }));


    return (
        <div className="qrCodeAndShareLinks">
            {dropdownElements.length > 1 &&
                <Dropdown
                    type="Languages"
                    elements={dropdownElements}
                    maxRows={5}
                    selectedElementId={props.selectedItemId}
                    onSelectElement={props.languageSelect}
                />}

            {props.linkOptions && (
                <Dropdown
                    type="Languages"
                    elements={props.linkOptions.map<IDropdownElement>((link) => ({
                        id: link,
                        label: link,
                    }))}
                    maxRows={5}
                    selectedElementId={props.link}
                    onSelectElement={props.onLinkSelected}
                    hideSelectedElementInList
                />
            )}
            <QrCode
                link={props.link}
                useLogo={props.useLogo}
                canvasMaxWidth={props.canvasMaxWidth}
                setDownloadableImage={setDownloadableImage}
            />
            <Button
                hrefAnchor={downloadableImage}
                downloadableName="qrcode.png"
                text={`${t(TK.General_Download)} .png`}
                secondary={true}
            />
            <div className="qrCodeAndShareLinks-linkWrapper">
                <span className="qrCodeAndShareLinks-link">{props.link}</span>
                <CopyToClipboard text={props.link} onCopy={onCopyLink}>
                    <div className="qrCodeAndShareLinks-icon">
                        <ClipboardIcon testId="qrCodeAndShareLinks-clipboardIcon" />
                    </div>
                </CopyToClipboard>
            </div>
        </div>
    );
}
