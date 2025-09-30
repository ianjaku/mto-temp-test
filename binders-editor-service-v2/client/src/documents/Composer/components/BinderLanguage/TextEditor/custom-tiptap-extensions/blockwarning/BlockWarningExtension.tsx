import { Node, mergeAttributes } from "@tiptap/core";
import { BlockWarningNode } from "./BlockWarningNode";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { maybeInsertNewLine } from "../tiptapChainHelpers";

export const BlockWarningExtension = Node.create({
    name: "blockWarning",
    group: "block",
    content: "block+",
    parseHTML() {
        return [
            {
                tag: "div[data-attentionblocktype=\"warning\"]",
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-attentionblocktype": "warning" }), 0]
    },
    addNodeView() {
        return ReactNodeViewRenderer(BlockWarningNode);
    },
    addCommands() {
        return {
            setBlockWarning:
                () =>
                    ({ editor }) => {
                        maybeInsertNewLine(editor);
                        return editor.chain()
                            .focus()
                            .clearNodes()
                            .unsetAllMarks()
                            .wrapIn("blockWarning")
                            .run();
                    },
        };
    },
})