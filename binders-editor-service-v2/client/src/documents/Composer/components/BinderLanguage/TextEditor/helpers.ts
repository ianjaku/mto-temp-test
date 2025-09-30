import { Editor, getMarkRange } from "@tiptap/react";
import { MarkType, ResolvedPos } from "@tiptap/pm/model";
import { createPortal } from "react-dom";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { normalizeHyperlinkUrl } from "@binders/ui-kit/lib/elements/text-editor/helpers";

const PHONE_NUMBER_REGEX = /^\+?\d+([\s-]\d+)*$/;
export function isValidPhoneNumber(text: string): boolean {
    return PHONE_NUMBER_REGEX.test(text);
}

export function isValidUrl(text: string): boolean {
    try {
        const url = new URL(normalizeHyperlinkUrl(text));
        return isHostnameValid(url.hostname);
    } catch {
        return false;
    }
}

function isHostnameValid(hostname: string): boolean {
    if (hostname === "localhost") return true;
    const hostnameParts = hostname.split(".");
    if (hostnameParts.length < 2) return false;
    if (hostnameParts.some(part => !part)) return false;
    return hostnameParts.at(-1).length > 1;
}

export function isAcceptedLink(text: string): boolean {
    return isValidPhoneNumber(text) || isValidUrl(text);
}

export function setNewLink(
    editor: Editor,
    newLinkTitle: string,
    href: string,
    openInNewTab: boolean,
): void {
    editor.chain()
        .focus()
        .insertContentAt(
            { from: editor.state.selection.from, to: editor.state.selection.to },
            newLinkTitle
        )
        .setTextSelection({
            from: editor.state.selection.from,
            to: editor.state.selection.from + newLinkTitle.length,
        })
        .setLink({
            href,
            target: openInNewTab ? "_blank" : "_self",
        })
        .setTextSelection({
            from: editor.state.selection.from + newLinkTitle.length,
            to: editor.state.selection.from + newLinkTitle.length,
        })
        .run();
}

/**
 * Note: we cannot use `extendMarkRange("link")` in conjunction with Link.extend({ inclusive: false })
 * so the range is calculated manually
*/
export function updateLink(
    editor: Editor,
    newLinkTitle: string,
    href: string,
    openInNewTab: boolean,
): void {
    const { state, view } = editor;
    const { selection } = state;
    const { $from } = selection;
    const range = getMarkRange($from as ResolvedPos, state.schema.marks.link as MarkType);
    if (!range) {
        return;
    }
    // Create a transaction to replace the link text
    const transaction = state.tr
        .insertText(newLinkTitle, range.from, range.to) // Replace the old text with the new title
        .addMark(
            range.from,
            range.from + newLinkTitle.length,
            state.schema.marks.link.create({
                href,
                target: openInNewTab ? "_blank" : "_self",
            })
        ); // Reapply the link mark to the new text

    // Apply the transaction
    view.dispatch(transaction);
}

export function maybePortal(children: React.ReactElement): React.ReactElement {
    if (isMobileView()) {
        return createPortal(children, document.body);
    }
    return children;
}