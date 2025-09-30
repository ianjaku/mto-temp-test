import * as React from "react";
import { FC, useCallback } from "react";
import Edit from "@binders/ui-kit/lib/elements/icons/Edit";
import { TranslationKeys as TK } from "@binders/client/lib/i18n/translations";
import cx from "classnames";
import { useActiveDocumentEditorUrl } from "../../../helpers/hooks/useActiveDocumentEditorUrl";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const EditDocumentButton: FC<{
    canEdit: boolean;
    invisible: boolean;
    isMinimal: boolean;
    linkToDefaultLanguage: boolean;
}> = (props) => {
    const url = useActiveDocumentEditorUrl(props);
    const { t } = useTranslation();
    const headerBgColor = window.bindersBranding.stylusOverrideProps?.headerBgColor;
    const goToEditor = useCallback(() => {
        if (!props.canEdit || !url) return;
        const win = window.open(url, "_blank");
        if (win) {
            win.focus();
        }
    }, [props.canEdit, url])

    if (!props.canEdit || !url) {
        return <div className="toolbarEditButton-hidden" />;
    }

    const bgHoverClassName = getHoverClassName(headerBgColor);

    return (
        <button
            data-url={url}
            className={cx(
                "toolbarEditButton toolbarPill",
                bgHoverClassName,
                props.isMinimal && "toolbarEditButton--minimal",
                props.invisible && "toolbarPill--hidden",
            )}
            onClick={goToEditor}
        >
            <Edit /> {props.isMinimal ? null : t(TK.General_Edit)}
        </button>
    )
}

function getHoverClassName(hexColor: string): string {
    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        } else {
            return null;
        }
        return { r, g, b };
    };

    const calculateLuminance = ({ r, g, b }: { r: number; g: number; b: number }): number => {
        const normalize = (value: number): number => {
            value /= 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        };
        const lR = normalize(r);
        const lG = normalize(g);
        const lB = normalize(b);
        return 0.2126 * lR + 0.7152 * lG + 0.0722 * lB;
    };

    if (!hexColor) return "";

    const rgb = hexToRgb(hexColor);

    if (!rgb) return "";
    const luminance = calculateLuminance(rgb);

    return luminance > 0.5 ? "bg-hover-darken-20" : "bg-hover-lighten-20";
}
