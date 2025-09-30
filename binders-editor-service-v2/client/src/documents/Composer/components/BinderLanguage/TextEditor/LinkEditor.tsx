import * as React from "react";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    isValidPhoneNumber,
    isValidUrl,
    maybePortal,
    setNewLink,
    updateLink
} from "./helpers";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import { Editor } from "@tiptap/react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import KeyboardReturn from "@binders/ui-kit/lib/elements/icons/KeyboardReturn";
import LinkIcon from "@binders/ui-kit/lib/elements/icons/Link";
import { TFunction } from "@binders/client/lib/i18n";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { normalizeHyperlinkUrl } from "@binders/ui-kit/lib/elements/text-editor/helpers";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./LinkEditor.styl";

export const LinkEditor: FC<{ editor: Editor, requestClose: () => void, alignCenter?: boolean }> = ({ editor, requestClose, alignCenter }) => {
    const { t } = useTranslation();

    const state = editor.state;
    const selectedText = useMemo(() => {
        const { from, to } = state.selection;
        const node = state.doc.nodeAt(from);
        if (node?.marks.some(mark => mark.type.name === "link")) {
            return node.textContent;
        }
        return state.doc.textBetween(from, to);
    }, [state]);

    const [isDirty, setIsDirty] = useState(false);
    const clickOutsideRef = useOutsideClick<HTMLDivElement>(requestClose);
    const submitButtonRef = useRef<HTMLDivElement>(null);
    const [shouldFocusSubmitButton, setShouldFocusSubmitButton] = useState(false);

    const previousLink: string = editor.getAttributes("link").href;
    const isExistingLink = !!previousLink;
    const previousOpenInNewTab = (editor.getAttributes("link").target ?? "_blank") === "_blank";
    const [linkTitle, setLinkTitle] = useState(selectedText);
    useEffect(() => setLinkTitle(selectedText), [selectedText]);

    const [link, setLink] = useState(removeTelPrefix(previousLink));
    const [openInNewTab, setOpenInNewTab] = useState(previousOpenInNewTab);
    const [linkInputFocused, setLinkInputFocused] = useState(false);

    const shouldDisplayAutocomplete = link && linkInputFocused;
    const { linkIsValid, linkIsPhoneNumber, linkCta, linkIcon } = useMemo(() => parseLinkCandidate(link, t), [link, t]);

    const saveButtonText = useMemo(() => {
        if (!isExistingLink) return t(TK.Edit_LinkEditor_AddLink);
        return t(linkIsValid ? TK.General_Save : TK.General_SaveAnyway);
    }, [isExistingLink, linkIsValid, t]);

    const shouldDisplayError = !shouldDisplayAutocomplete && link && !linkIsValid;

    const submitChanges = useCallback(() => {
        if (!isDirty) return;
        requestClose();
        const newLinkTitle = linkTitle || link;
        const href = linkIsPhoneNumber ? addTelPrefix(link) : normalizeHyperlinkUrl(link);
        if (isExistingLink) {
            updateLink(editor, newLinkTitle, href, openInNewTab);
        } else {
            setNewLink(editor, newLinkTitle, href, openInNewTab);
        }
        editor.view.focus();
    }, [editor, isDirty, isExistingLink, link, linkIsPhoneNumber, linkTitle, openInNewTab, requestClose]);

    React.useEffect(() => {
        if (shouldFocusSubmitButton && submitButtonRef.current) {
            submitButtonRef.current.tabIndex = -1;
            submitButtonRef.current.focus();
            setShouldFocusSubmitButton(false);
        }
    }, [shouldFocusSubmitButton]);

    return maybePortal(
        <div className={cx("link-editor-backdrop", { "link-editor-backdrop--alignCenter": alignCenter })} ref={clickOutsideRef}>
            <div className="link-editor">
                <div className="link-editor-mobileHeader">
                    <label>{t(TK.Edit_LinkEditor_EditLink)}</label>
                    <label
                        className="link-editor-mobileHeader-cancelBtn"
                        onClick={requestClose}
                    >
                        <Close />
                    </label>
                </div>
                <div className="link-editor-content">
                    <div className="link-editor-content-group">
                        <label className="link-editor-content-group-label" htmlFor="link-title">{t(TK.Edit_LinkEditor_LinkTitle)}</label>
                        <input
                            className="link-editor-content-group-input"
                            id="link-title"
                            type="text"
                            onChange={e => {
                                setIsDirty(true);
                                setLinkTitle(e.target.value);
                            }}
                            value={linkTitle ?? ""}
                            placeholder={link}
                            data-testid="input-linktitle"
                            autoFocus // triggers keyboard on mobile so it's open by default (avoids jumping)
                        />
                    </div>
                    <div className="link-editor-content-group">
                        <label className="link-editor-content-group-label" htmlFor="link">{t(TK.Edit_Link)}</label>
                        <div className={cx(
                            "link-editor-content-group-input-with-autocomplete",
                            { "link-editor-content-group-input-with-autocomplete-visible": shouldDisplayAutocomplete }
                        )}>
                            <input
                                className={cx("link-editor-content-group-input", {
                                    "link-editor-content-group-input--withError": shouldDisplayError,
                                    "link-editor-content-group-input--withPrefix": linkIsValid,
                                })}
                                id="link"
                                type="text"
                                onChange={e => {
                                    setIsDirty(true);
                                    setLink(e.target.value);
                                }}
                                value={link ?? ""}
                                onFocus={() => setLinkInputFocused(true)}
                                onBlur={() => setLinkInputFocused(false)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && linkIsValid) {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        if (isDirty) {
                                            setShouldFocusSubmitButton(true);
                                        }
                                    }
                                }}
                                data-testid="input-link"
                            />
                            {linkIsValid && (
                                <label className="link-editor-content-group-input-prefix">
                                    {linkIcon || <LinkIcon />}
                                </label>
                            )}
                            {shouldDisplayError && <span className="link-editor-content-group-autocomplete-error" data-testid="link-editor-error">
                                {t(TK.Edit_LinkEditor_ValidationError)}
                            </span>}
                            {shouldDisplayAutocomplete && (
                                <div className={cx(
                                    "link-editor-content-group-autocomplete",
                                    { "link-editor-content-group-autocomplete--linkIsValid": linkIsValid }
                                )}>
                                    <div className="link-editor-content-group-autocomplete-link">
                                        <span className="link-editor-content-group-autocomplete-value">
                                            {linkIcon || <LinkIcon />}
                                            <span className="link-editor-content-group-autocomplete-value-text">{link}</span>
                                        </span>
                                        <span className="link-editor-content-group-autocomplete-message">
                                            {linkIsValid ? linkCta : t(TK.Edit_LinkEditor_LinkInvalid)}
                                        </span>
                                    </div>
                                    {linkIsValid && <div className="link-editor-content-group-autocomplete-enter">
                                        {t(TK.General_Enter)}
                                        <KeyboardReturn/>
                                    </div>}
                                </div>
                            )}
                        </div>
                    </div>
                    {!shouldDisplayAutocomplete && (
                        <div className="link-editor-content-footer">
                            <div className="link-editor-content-newtabsetting">
                                <Checkbox
                                    onCheck={(v) => {
                                        setIsDirty(true);
                                        setOpenInNewTab(v);
                                    }}
                                    checked={openInNewTab}
                                    label={t(TK.General_OpenInNewTab)}
                                />
                            </div>
                            <div className="link-editor-content-buttons">
                                {isExistingLink && !isMobileView() && (
                                    <Button
                                        text={t(TK.Edit_LinkEditor_RemoveLink)}
                                        onClick={() => {
                                            editor.chain()
                                                .extendMarkRange("link")
                                                .unsetLink().run();
                                            editor.view.focus();
                                            requestClose();
                                        }}
                                        secondary
                                    />
                                )}
                                <Button
                                    text={saveButtonText}
                                    isEnabled={isDirty}
                                    onClick={submitChanges}
                                    data-testid="button-linksave"
                                    ref={submitButtonRef}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !shouldDisplayAutocomplete) {
                                            e.preventDefault();
                                            submitChanges();
                                        }}}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function parseLinkCandidate(text: string, t: TFunction): { linkIsValid: boolean, linkIsPhoneNumber?: boolean, linkCta?: string, linkIcon?: JSX.Element } {
    if (!text || text.length < 3) {
        return { linkIsValid: false };
    }
    if (isValidPhoneNumber(text)) {
        return {
            linkIsValid: true,
            linkIsPhoneNumber: true,
            linkCta: t(TK.Edit_LinkEditor_LinkPhoneCta),
            linkIcon: <Icon name="phone"/>
        };
    }
    return {
        linkIsValid: isValidUrl(text),
        linkCta: t(TK.Edit_LinkEditor_LinkWebCta),
    };
}

function addTelPrefix(link: string): string {
    if (!link) {
        return link;
    }
    return link.startsWith("tel:") ? link : `tel:${link}`;
}

function removeTelPrefix(link?: string): string {
    if (!link) {
        return link;
    }
    return link.replace(/^tel:/, "");
}