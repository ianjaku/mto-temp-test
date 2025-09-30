import * as React from "react";
import { EmojiImageProps } from "../..";
import { ReactElement } from "react";
import { getEmojiPathByName } from "../../utils/emojis";

export default function ManualtoLocallEmojiImage({
    emoji,
}: EmojiImageProps): ReactElement {
    const imgSrc = getEmojiPathByName(emoji);
    return (
        <img
            src={imgSrc}
            className={"emojiSelectPopoverEntryIcon"}
            title={emoji}
            draggable={false}
            role="presentation"
        />
    );
}
