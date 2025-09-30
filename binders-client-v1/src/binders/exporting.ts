import BinderClass from "./custom/class";
import { EditorState } from "draft-js";
import RTEState from "../draftjs/state";

export function toPseudoXml(binder: BinderClass, langIdx: number): string {
    const body = binder.getAllEditorStatesByLanguageIndex(langIdx);
    const title = binder.getTitle(binder.getLanguageIsoByIndex(langIdx));
    if (!title.length) return "";
    const chunks = body
        .map(c => `<chunk>${editorStateToHtmlOrEmpty(c)}</chunk>`)
        .join("\n")
        .trim()
    return `<manual>\n<title>${escapeXml(title)}</title>\n<chunks>\n${chunks}\n</chunks>\n</manual>`;
}

export function safeEditorStateOrNull(editorStateOrString: EditorState | string | null | undefined): EditorState | null {
    if (!editorStateOrString) return null;
    try {
        return typeof editorStateOrString === "string" ?
            RTEState.deserialize(editorStateOrString) :
            editorStateOrString;
    } catch (err) {
        return null;
    }
}

export function editorStateToMarkdownOrEmpty(editorStateOrString: EditorState | string | null | undefined): string {
    const editorState = safeEditorStateOrNull(editorStateOrString);
    if (!editorState) return "";
    try {
        return RTEState.toMarkdown(editorState).trim();
    } catch (err) {
        return "";
    }
}

export function editorStateToHtmlOrEmpty(editorStateOrString: EditorState | string | null | undefined): string {
    if (!editorStateOrString) return "";
    try {
        const editorState = typeof editorStateOrString === "string" ?
            RTEState.deserialize(editorStateOrString) :
            editorStateOrString;
        return RTEState.toHTML(editorState).trim().replace("<br>", "<br/>");
    } catch (err) {
        return "";
    }
}

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

