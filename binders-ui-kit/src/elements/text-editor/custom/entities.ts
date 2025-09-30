import { EditorState } from "draft-js";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function getEntityDataFromCurrentBlock(editorState: EditorState) {
    const entities = entitiesFromCurrentBlock(editorState);
    return entities.length ? entities[0].entity.getData() : {};
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getEntityAndSelectionFromCurrentBlock(editorState: EditorState) {
    const [entity] = entitiesFromCurrentBlock(editorState);
    return entity;
}

const entitiesFromCurrentBlock = (editorState: EditorState) => {
    const selection = editorState.getSelection();
    const contentState = editorState.getCurrentContent();
    const contentBlock = contentState.getBlockForKey(selection.getStartKey());
    const entities = [];

    if (!contentBlock) {
        return entities;
    }

    let entity;
    contentBlock.findEntityRanges(
        character => {
            const entityKey = character.getEntity();
            entity = entityKey && contentState.getEntity(entityKey);
            return entity !== null;
        },
        (start, end) => {
            const selectionStart = selection.getStartOffset();
            const selectionEnd = selection.getEndOffset();
            const charEnd = selection.isCollapsed() ? end : end + 1;
            if (selectionStart >= start && selectionEnd <= charEnd) {
                entities.push({ entity, start, end });
            }
        },
    );
    return entities;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function extractSelectedText(editorState: EditorState) {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();
    const hasSelection = !selection.isCollapsed();
    const block = hasSelection && content.getBlockForKey(selection.getStartKey());
    const endOffset = selection.getEndOffset();
    if (!block) {
        return undefined;
    }
    if (endOffset === 0) {
        // this can happen when the user has double or triple clicked and the selection expands until the beginning of the next block
        // bug report: https://github.com/facebook/draft-js/issues/402
        return block.getText();
    }
    return block.getText().slice(selection.getStartOffset(), endOffset);
}