import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import React from "react";
import "@binders/ui-kit/lib/style/AttentionBlock.styl";

export const BlockWarningNode: React.FC = () => {
    return (
        <NodeViewWrapper className="blockwarning">
            <div data-attentionblocktype="warning">
                <NodeViewContent className="content" />
            </div>
        </NodeViewWrapper>
    )
}