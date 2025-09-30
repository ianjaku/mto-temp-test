import * as React from "react";
import { normalizeHyperlink, validateHyperlink } from "../helpers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "../../button";
import Checkbox from "../../checkbox";
import Floater from "../../floater/Floater";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "../../../variables";
import "./linkCreator.styl";

interface Props {
    arrowLeft: number;
    arrowPosition: string;
    onClose: () => void;
    onSave: (hyperlink: Hyperlink) => void;
    hyperlink?: Hyperlink;
    top: string | number;
    left: string | number;
    right?: string | number;
    className?: string
}

export interface Hyperlink {
    text: string;
    url: string;
    target: string;
    isCallToLink: boolean;
}

function createNewLink(): Hyperlink {
    return {
        text: "",
        url: "",
        target: "_blank",
        isCallToLink: false,
    };
}

const LinkCreator: React.FC<Props> = ({
    hyperlink: propsHyperlink,
    arrowLeft,
    arrowPosition,
    left,
    top,
    className,
    onSave,
    onClose,
}) => {

    const { t } = useTranslation();
    const linkCreatorRef = useRef<HTMLDivElement>(null);
    const [hyperlink, setHyperlink] = useState(propsHyperlink || createNewLink());
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const handleSave = useCallback(() => {
        const normalizedLink = normalizeHyperlink(hyperlink);
        const validationErrors = validateHyperlink(normalizedLink);
        setValidationErrors(validationErrors);
        if (validationErrors.length === 0) {
            onSave(normalizedLink);
        }
    }, [hyperlink, onSave]);

    const enableEnterToCreate = useMemo(() => !(navigator.userAgent.match(/Firefox/)), []);
    useEffect(() => setHyperlink(propsHyperlink), [propsHyperlink]);

    const updateHyperLink = React.useCallback((propName: string, propValue: string | boolean) => {
        setHyperlink({
            ...hyperlink,
            [propName]: propValue,
        });
    }, [hyperlink]);

    const validationErrorsList = useMemo(() => {
        return validationErrors.map((errorStr, i) => (
            <span className="rte-link-creator-warning" key={`valerr${i}`}>
                {t(TK[errorStr])}
            </span >
        ));
    }, [t, validationErrors]);

    const onInputKeyDown = useCallback((e) => {
        if (enableEnterToCreate && e.key === "Enter" || e.which === 13) {
            e.preventDefault();
            handleSave();
        }
    }, [enableEnterToCreate, handleSave]);

    const textInput = React.useMemo(() => (
        <div>
            <div className="rte-form-group">
                <label className="link-creator-label">{t(TK.General_Text)}</label>
                <input
                    type="text"
                    onChange={(e) => updateHyperLink("text", e.target.value)}
                    value={hyperlink.text || ""}
                    autoFocus={!!(propsHyperlink?.url)}
                />
            </div>
            <Checkbox
                onCheck={isChecked => updateHyperLink("isCallToLink", isChecked)}
                disabled={!(hyperlink.text?.length)}
                label={t(TK.Edit_MakeCallToLink)}
                checked={hyperlink.isCallToLink}
                labelStyle={{ color: vars.whiteColor }}
                iconStyle={{ fill: vars.accentColor }}
                isControlled={true}
            />
        </div>
    ), [hyperlink, t, updateHyperLink, propsHyperlink]);

    const handleDocumentClick = useCallback((e: MouseEvent & { target: HTMLInputElement }) => {
        const triggersSaveAndClose = !e.target.closest(".rte-link-button-wrapper");
        if (triggersSaveAndClose) {
            handleSave();
        }
    }, [handleSave]);

    useEffect(() => {
        document.addEventListener("click", handleDocumentClick);
        return () => document.removeEventListener("click", handleDocumentClick);
    }, [handleDocumentClick]);

    const urlInput = React.useMemo(() => (
        <div>
            <div className="rte-form-group">
                <label className="link-creator-label">{t(hyperlink.isCallToLink ? TK.General_TelephoneAbbr : TK.General_Url)}</label>
                <input
                    type="text"
                    onChange={e => updateHyperLink("url", e.target.value)}
                    onKeyDown={onInputKeyDown}
                    value={hyperlink.url || ""}
                    autoFocus={!(propsHyperlink?.url)}
                />
            </div>
            {validationErrorsList}
        </div>
    ), [t, hyperlink, onInputKeyDown, propsHyperlink, validationErrorsList, updateHyperLink]);

    const targetInput = React.useMemo(() => (
        <div className="rte-form-group target-input">
            <Checkbox
                onCheck={isChecked => updateHyperLink("target", isChecked ? "_blank" : "_self")}
                label={t(TK.General_OpenInNewTab)}
                checked={hyperlink.target === "_blank"}
                labelStyle={{ color: vars.whiteColor }}
                iconStyle={{ fill: vars.accentColor }}
                style={{ width: "initial", display: "inline-block", flexGrow: 1 }}
                isControlled={true}
            />
            <div>
                <Button
                    text={t(TK.General_Ok)}
                    onClick={handleSave}
                    isEnabled={true}
                    CTA={true}
                />
                <Button
                    text={t(TK.General_Cancel)}
                    onClick={onClose}
                    isEnabled={true}
                    CTA={false}
                />
            </div>
        </div>
    ), [handleSave, hyperlink, onClose, t, updateHyperLink]);

    return (
        <Floater
            collapsed={false}
            top={top}
            left={left}
            className={`rte-link-button-wrapper ${className}`}
            arrowLeft={arrowLeft}
            arrowPosition={arrowPosition}
            widthOverride="520px"
        >
            <div className="rte-link-creator" ref={linkCreatorRef}>
                {textInput}
                {urlInput}
                {targetInput}
            </div>
        </Floater>
    )
}

export default LinkCreator;
