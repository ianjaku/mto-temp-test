import * as React from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { FlashMessages } from "../../../../../../logging/FlashMessages";
import { SemanticLinkRow } from "../../SemanticLinkManagerSet";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { containsUrlScheme } from "@binders/client/lib/util/uri";
import cx from "classnames";
import { omit } from "ramda";
import slugify from "@binders/client/lib/util/slugify";
import { updateSemanticLink } from "../../actions";
import { useCallback } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useMemo, useEffect, useState, useRef } = React;

function slugifyValue(text: string): string {
    return slugify(text, {
        lower: true,
        trim: false,
        strict: true,
        allowSlash: true,
    });
}

interface IProps {
    semanticLinkRow: SemanticLinkRow;
    setIsLoading: (isLoading: boolean) => void;
    setIsFakeSemlinkShown: (shown: boolean) => void;
    unpublishedLangCodes: string[];
    widthRestriction?: number;
    documentLink: string;
}

const SemanticLinkManagerInput: React.FC<IProps> = ({
    semanticLinkRow,
    setIsLoading,
    setIsFakeSemlinkShown,
    unpublishedLangCodes,
    widthRestriction,
    documentLink
}) => {
    const [val, setVal] = useState("");
    const [originalVal, setOriginalVal] = useState("");
    const [showingTooltip, setShowingTooltip] = useState(false);

    useEffect(() => {
        setVal(semanticLinkRow.semanticId);
        setOriginalVal(semanticLinkRow.semanticId);
    }, [semanticLinkRow]);
    const { t } = useTranslation();
    const inputRef = useRef(null);

    const onChange = useCallback((e) => {
        setVal(slugifyValue(e.target.value || ""));
    }, []);

    const handleNonInput = useCallback(() => {
        if (semanticLinkRow.isFake) {
            if (!val) {
                setIsFakeSemlinkShown(false);
                return false;
            }
        } else {
            if (!val) {
                setVal(originalVal);
                return false;
            }
            if (val === originalVal) {
                return false;
            }
        }
        return true;
    }, [originalVal, semanticLinkRow, setIsFakeSemlinkShown, val]);

    const onSave = useCallback(async () => {
        const proceed = handleNonInput();
        if (!proceed) {
            return;
        }
        setIsLoading(true);
        try {
            const trimmedVal = val.replace(/\/+$/g, "");
            const success = await updateSemanticLink(omit(["isFake"], {...semanticLinkRow, semanticId: trimmedVal}), t);
            if (success) {
                if (trimmedVal !== val) {
                    setVal(trimmedVal);
                }
                setIsFakeSemlinkShown(false);
                if (unpublishedLangCodes.includes(semanticLinkRow.languageCode)) {
                    FlashMessages.success(t(TK.DocManagement_SemLinkUnpublishedSuccess));
                }
            } else {
                setVal(originalVal);
            }
        } catch (err) {
            FlashMessages.error(t(TK.DocManagement_SemLinkSetFail, { error: err.message || err }));
            setVal(originalVal);
        } finally {
            setIsLoading(false);
        }
    }, [handleNonInput, originalVal, semanticLinkRow, setIsFakeSemlinkShown, setIsLoading, t, unpublishedLangCodes, val]);

    const onKeyDown = useCallback(async (e) => {
        const keyCode = e.keyCode || e.which;
        const isEnterPressed = e.key === "enter" || keyCode === 13;
        if (isEnterPressed) {
            inputRef.current.blur();
            e.stopPropagation();
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        if (semanticLinkRow.isFake) {
            inputRef.current.focus();
        }
    }, [semanticLinkRow.isFake]);

    const onPasteLink = useCallback((e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        if (containsUrlScheme(text)) {
            FlashMessages.info(t(TK.DocManagement_SemLinkPasteLinkFail));
            return;
        }
        setVal(slugify(text || ""));
    }, [t]);

    const domainLblRef = useRef(null);

    const domainLblWidth = domainLblRef?.current?.clientWidth;

    const [linkLblMaxWidth, wrapperProps] = useMemo<[string, React.CSSProperties]>(() => {
        if (!domainLblWidth) {
            return ["0", {}];
        }
        if (!widthRestriction) {
            return ["100%", {}];
        }
        const twoRowBreakpoint = widthRestriction - 180;
        return domainLblWidth < twoRowBreakpoint ?
            [`calc(${widthRestriction}px - ${domainLblWidth}px - 110px)`, {}] :
            ["initial", { flexDirection: "column", alignItems: "flex-start" }];
    }, [domainLblWidth, widthRestriction]);

    const renderLink = useCallback(() => {
        if (semanticLinkRow.isFake) {
            return (
                <input
                    type="text"
                    className={cx("semanticLinkManagerInput-txt", {
                        "semanticLinkManagerInput-txt--isNewInput": semanticLinkRow.isFake,
                    })}
                    value={val}
                    onChange={onChange}
                    onBlur={onSave}
                    onKeyDown={onKeyDown}
                    placeholder={t(TK.DocManagement_SemLinkPlaceholder)}
                    ref={inputRef}
                    style={{ maxWidth: linkLblMaxWidth }}
                    onPaste={onPasteLink}
                />
            );
        }
        return (
            <label
                className="semanticLinkManagerInput-lbl semanticLinkManagerInput-clickable"
                style={{ maxWidth: linkLblMaxWidth }}
            >
                {val}
            </label>
        )
    }, [linkLblMaxWidth, onChange, onKeyDown, onPasteLink, onSave, semanticLinkRow.isFake, t, val]);

    useEffect(() => {
        if (!showingTooltip) return;
        const timeout = setTimeout(() => {
            setShowingTooltip(false);
        }, 3000);
        return () => clearTimeout(timeout);
    }, [showingTooltip])

    if (semanticLinkRow.isFake) {
        return (
            <div
                className="semanticLinkManagerInput"
                style={{ ...wrapperProps }}
            >
                <label ref={domainLblRef} className="semanticLinkManagerInput-clickable">
                    {semanticLinkRow.domain}/
                </label>
                {renderLink()}
            </div>
        )
    }

    return (
        <CopyToClipboard text={documentLink}>
            <div
                className="semanticLinkManagerInput"
                onClick={() => setShowingTooltip(true)}
                style={{ ...wrapperProps }}
            >
                <label ref={domainLblRef} className="semanticLinkManagerInput-clickable">
                    {semanticLinkRow.domain}
                </label>
                /
                {renderLink()}
                {showingTooltip && (
                    <div className="semanticLinkManagerInput-tooltip">
                        {t(TK.DocManagement_CopyLink, { link: documentLink })}
                    </div>
                )}
            </div>
        </CopyToClipboard>
    )
}

export default SemanticLinkManagerInput