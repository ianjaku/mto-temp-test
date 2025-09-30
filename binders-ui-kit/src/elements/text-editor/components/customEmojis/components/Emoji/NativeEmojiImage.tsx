import * as React from "react";
import { EmojiImageProps } from "../..";
import { ReactElement } from "react";
import { shortnameToUnicode } from "emoji-toolkit";

export default function NativeEmojiImage({
    emoji,
}: EmojiImageProps): ReactElement {
    return <span title={emoji}>{shortnameToUnicode(emoji)}</span>;
}
