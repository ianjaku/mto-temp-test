import { Editor } from "@tiptap/core";

/**
 * This function inserts a new line if the currently active node is at the end of the document
 * Usage: when setting a node as a custom block, this empty line make sure the user can easily click outside of it to continue typing
 */

export function maybeInsertNewLine(editor: Editor) {
    const $from = editor.state.selection.$from;
    const nodeDepth = $from.depth;
    const nodeStartPos = $from.before(nodeDepth);
    const node = $from.node(nodeDepth);
    const posAfterNode = nodeStartPos + node.nodeSize;
    const isNodeAtEnd = posAfterNode === editor.state.doc.content.size;
    if (isNodeAtEnd) {
        editor.chain()
            .insertContentAt(
                editor.state.selection.$from.after(),
                {
                    type: "paragraph",
                    content: [],
                },
                { updateSelection: false }
            )
            .run();
    }
}