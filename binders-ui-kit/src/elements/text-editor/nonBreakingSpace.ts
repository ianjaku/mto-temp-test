import {
    ContentBlock,
    ContentState,
    EditorState,
    Modifier,
    SelectionState,
} from "draft-js";
import { CHARACTERS } from "@binders/client/lib/draftjs/constants";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function onNonBreakingSpaceReplace(onChangeCallback, editorState): void {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();

    const selectionText = _getTextSelection(content, selection);
    const replacedSeparators = selectionText.split(/[\s]+/).join(CHARACTERS.NON_BREAKING_SPACE);

    const newContentState = Modifier.replaceText(content, selection, replacedSeparators);
    onChangeCallback(EditorState.push(editorState, newContentState, "insert-characters"));
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function onNonBreakingSpaceInsert(onChangeCallback, editorState): void {
    const newContentState = Modifier.insertText(
        editorState.getCurrentContent(),
        editorState.getSelection(),
        CHARACTERS.NON_BREAKING_SPACE,
    );
    const change = "insert-characters";
    onChangeCallback(EditorState.push(editorState, newContentState, change));
}

// gets the real text from selection (selection can cross multiple blocks)
function _getTextSelection(contentState: ContentState, selection: SelectionState, blockDelimiter?: string) {
    blockDelimiter = blockDelimiter || "\n";
    const startKey = selection.getStartKey();
    const endKey = selection.getEndKey();
    const blocks = contentState.getBlockMap();
    let lastCharacterWasEndOfSelection = false;
    const selectedBlock = blocks
        .skipUntil(function findBlockWithSelectionStart(block: ContentBlock) {
            return block.getKey() === startKey;
        })
        .takeUntil(function findBlockWithSelectionEnd(block: ContentBlock) {
            const result = lastCharacterWasEndOfSelection;
            if (block.getKey() === endKey) {
                lastCharacterWasEndOfSelection = true;
            }
            return result;
        });

    return selectedBlock
        .map((block) => {
            const key = block.getKey();
            const text = block.getText();

            let start = 0;
            let end = text.length;

            if (key === startKey) {
                start = selection.getStartOffset();
            }
            if (key === endKey) {
                end = selection.getEndOffset();
            }
            return text.slice(start, end);
        })
        .join(blockDelimiter);
}
