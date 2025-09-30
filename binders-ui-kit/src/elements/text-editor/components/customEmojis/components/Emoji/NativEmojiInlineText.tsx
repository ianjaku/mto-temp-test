import * as React from "react";
import { EmojiInlineTextProps } from "../..";
import { ReactElement } from "react";
import { toShort } from "emoji-toolkit";

export default function NativeEmojiInlineText({
    decoratedText,
    children,
}: EmojiInlineTextProps): ReactElement {
    return <span title={toShort(decoratedText)}>{children}</span>;
}
