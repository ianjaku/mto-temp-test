import { Node, mergeAttributes } from "@tiptap/core";
import { BlockInfoNode } from "./BlockInfoNode";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { maybeInsertNewLine } from "../tiptapChainHelpers";

export const BlockInfoExtension = Node.create({
    name: "blockInfo",
    group: "block",
    content: "block+",
    parseHTML() {
        return [
            {
                tag: "div[data-attentionblocktype=\"info\"]",
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-attentionblocktype": "info" }), 0]
    },
    addNodeView() {
        return ReactNodeViewRenderer(BlockInfoNode);
    },
    addCommands() {
        return {
            setBlockInfo:
                () =>
                    ({ editor }) => {
                        maybeInsertNewLine(editor);
                        return editor.chain()
                            .focus()
                            .clearNodes()
                            .unsetAllMarks()
                            .wrapIn("blockInfo")
                            .run();
                    },
        };
    },
})