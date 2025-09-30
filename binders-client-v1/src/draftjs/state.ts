/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ContentState, EditorState, convertFromRaw, convertToRaw } from "draft-js";
import { DECORATORS, FONT_SIZE_PREFIX, buildExportStyleMap } from "./constants";
import { convertFromHTML } from "draft-convert";
import { safeEditorStateOrNull } from "../binders/exporting";
import { stateToHTML } from "draft-js-export-html";
import { stateToMarkdown } from "draft-js-export-markdown";

// Webpack can't seem to locate this
class RTEState {
    static createSerializedEmtpy() {
        return RTEState.serialize(RTEState.createEmpty());
    }

    static createEmpty() {
        return EditorState.createEmpty();
    }

    static createFromHtml(html: string) {
        const blocksFromHTML = convertFromHTML(this.importerConfig())(html);
        const state = convertToRaw(blocksFromHTML);
        return EditorState.createWithContent(convertFromRaw(state));
    }

    static createFromText(text: string) {
        const content = ContentState.createFromText(text);
        return EditorState.createWithContent(content);
    }

    static toMarkdown(editorState: EditorState | null) {
        if (!editorState) return "";
        const markdown = stateToMarkdown(editorState.getCurrentContent());
        return markdown;
    }

    static toHTML(editorState: EditorState | null): string {
        if (!editorState) return "";
        const options = {
            inlineStyles: buildExportStyleMap()
        };
        const html = stateToHTML(editorState.getCurrentContent(), options);
        return html;
    }

    static importerConfig() {
        return {
            htmlToStyle: (nodeName, node, currentStyle) => {
                if (nodeName === "span" && node.style.fontSize) {
                    const fontSize = parseFloat(node.style.fontSize.replace(/(r)?em$/g, ""));
                    return currentStyle.add(`${FONT_SIZE_PREFIX}${Math.round(100 * fontSize)}`);
                }
                return currentStyle;
            },
            htmlToEntity: (nodeName, node, createEntity) => {
                if (nodeName === "a") {
                    return createEntity(
                        DECORATORS.LINK,
                        "MUTABLE",
                        { url: node.href }
                    )
                }
            },
        };
    }

    static getRawText(editorState: EditorState | null) {
        return RTEState.toHTML(editorState).replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, " ");
    }

    static getRawTextTrimmed(editorState: EditorState | null) {
        return RTEState.toHTML(editorState).replace(/<\/?[^>]+(>|$)/g, "").replace(/&nbsp;/g, "").trim();
    }

    static isSemanticallyEmpty(editorState: EditorState | null) {
        if (!editorState) {
            // eslint-disable-next-line no-console
            console.error(`isSemanticallyEmpty called with ${editorState} editorState`);
            return true;
        }
        return !RTEState.getRawTextTrimmed(editorState);
    }

    static serialize(editorState: EditorState | null) {
        if (editorState) {
            return JSON.stringify(convertToRaw(editorState.getCurrentContent()));
        }
        else {
            return JSON.stringify(null);
        }
    }

    static deserialize(serializedState: string) {
        const deserialized = JSON.parse(serializedState);
        if (deserialized) {
            return EditorState.createWithContent(convertFromRaw(deserialized));
        } else {
            return EditorState.createEmpty();
        }
    }

    static deserializeForTranslate(serializedState: string) {
        const deserialized = JSON.parse(serializedState);
        if (deserialized) {
            return EditorState.createWithContent(convertFromRaw(deserialized));
        }
        else {
            return null
        }
    }

    static mergeStates(leftStateOrString: EditorState | string, rightStateOrString: EditorState | string) {
        const leftState = safeEditorStateOrNull(leftStateOrString);
        const rightState = safeEditorStateOrNull(rightStateOrString);
        const leftContentBlocks = leftState ? leftState.getCurrentContent().getBlocksAsArray() : [];
        const rightContentBlocks = rightState ? rightState.getCurrentContent().getBlocksAsArray() : [];
        const mergedBlocks = leftContentBlocks.concat(rightContentBlocks);
        const lastBlock = mergedBlocks[mergedBlocks.length - 1];
        if (lastBlock && lastBlock.getText().trim().length === 0) {
            mergedBlocks.pop();
        }
        const mergedContent = ContentState.createFromBlockArray(mergedBlocks);
        const firstKey = mergedContent.getBlockMap().first();
        return firstKey ?
            EditorState.createWithContent(mergedContent) :
            EditorState.createEmpty();
    }
}

export default RTEState;
