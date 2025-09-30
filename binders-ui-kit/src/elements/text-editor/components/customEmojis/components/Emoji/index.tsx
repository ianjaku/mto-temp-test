import * as React from "react"
import { ComponentType, ReactElement, ReactNode } from "react";
import { EmojiInlineTextProps } from "../..";

export interface EmojiProps {
    children: ReactNode;
    className: string;
    decoratedText: string;
    emojiInlineText: ComponentType<EmojiInlineTextProps>;
}

export default function Emoji({
    className,
    decoratedText,
    emojiInlineText: EmojiInlineText,
    children,
}: EmojiProps): ReactElement {
    return (
        <EmojiInlineText
            className={className}
            decoratedText={decoratedText}
        >
            {children}
        </EmojiInlineText>
    );
}
