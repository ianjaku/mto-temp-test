import { BubbleMenu, BubbleMenuProps } from "@tiptap/react";
import React, { FC } from "react";

type Props = BubbleMenuProps & {
    children: React.ReactNode;
}

export const TextEditorFloater: FC<Props> = (props) => {
    return (
        <div> {/* wrapping the BubbleMenu in a div avoids "node to be removed is not a child of this node." error which crashes the editor */}
            <BubbleMenu
                {...props}
            >
                {props.children}
            </BubbleMenu>
        </div>
    );
}