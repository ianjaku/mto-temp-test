import { EditorState, Modifier } from "draft-js";
import { createLink } from "../decorators/link";
import { getEntityAndSelectionFromCurrentBlock } from "./entities";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function toggleLink(editorState, text, url, target, isCallToLink, pasted = false) {
    const entity = getEntityAndSelectionFromCurrentBlock(editorState);
    return updateLink(editorState, text, url, target, isCallToLink, pasted, entity);
}

function updateLink(editorState, text, url, target, isCallToLink, pasted, entity?) {
    const linkProps = getLinkProperties(editorState, text, url, target, isCallToLink, pasted);
    const { currentContent, selection, link, isBackward } = linkProps;
    const entitycontent = Modifier.applyEntity(currentContent, selection, link);
    let trimmedSelection = {};
    const trimmedText = text.trim();
    const anchorOffset = selection.getAnchorOffset();
    const focusOffset = selection.getFocusOffset();
    // because IE does not support endsWith
    if (text.startsWith(" ") || /\s+$/.test(text)) {
        const frontTrimmedText = text.replace(/^\s+/, "");
        const frontSpacesCount = text.length - frontTrimmedText.length;
        const backTrimmedText = text.replace(/\s+$/, "");
        const backSpacesCount = text.length - backTrimmedText.length;
        // calculate selection without spaces on the right and left
        trimmedSelection = selection.merge({
            anchorOffset: isBackward ?
                focusOffset + frontSpacesCount + trimmedText.length :
                anchorOffset + frontSpacesCount,
            focusOffset: isBackward ?
                anchorOffset - backSpacesCount - trimmedText.length :
                focusOffset - backSpacesCount,
        });
    }
    const rangeToReplace = selection.merge(entity ?
        {
            anchorOffset: isBackward ? entity.end : entity.start,
            focusOffset: isBackward ? entity.start : entity.end,
        } :
        trimmedSelection);

    return EditorState.set(editorState, {
        currentContent: Modifier.replaceText(
            entitycontent,
            rangeToReplace,
            trimmedText || url,
            null,
            url && link,
        ),
    });
}

const getLinkProperties = (editorState, text, url, target, isCallToLink, pasted) => {
    const currentContent = editorState.getCurrentContent();
    const selection = editorState.getSelection();
    const isPasted = pasted || (!text && selection.isCollapsed());
    const link = createLink(currentContent, url, text, target, isCallToLink, isPasted);
    const isBackward = selection.getIsBackward();
    return { currentContent, selection, link, isBackward };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getSelectedTextLength = (selection) => {
    return selection.getIsBackward() ?
        selection.getAnchorOffset() - selection.getFocusOffset() :
        selection.getFocusOffset() - selection.getAnchorOffset();
};

export default toggleLink;
