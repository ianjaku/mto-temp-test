import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import React from "react";
import "@binders/ui-kit/lib/style/AttentionBlock.styl";

export const BlockInfoNode: React.FC = () => {
    return (
        <NodeViewWrapper className="blockinfo">
            <div data-attentionblocktype="info">
                <NodeViewContent className="content" />
            </div>
        </NodeViewWrapper>
    )
}