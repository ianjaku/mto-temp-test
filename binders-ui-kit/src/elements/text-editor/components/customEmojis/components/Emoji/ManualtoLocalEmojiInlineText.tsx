import * as React from "react";
import { EmojiInlineTextProps } from "../..";
import NativeEmojiInlineText from "./NativEmojiInlineText";
import { ReactElement } from "react";
import classnames from "classnames";
import { getEmojiPathByName } from "../../utils/emojis";
import { toShort } from "emoji-toolkit";

export default function ManualtoLocalEmojiInlineText({
    decoratedText,
    children,
    className,
}: EmojiInlineTextProps): ReactElement {
    const shortName = toShort(decoratedText);
    const emojiUrl = getEmojiPathByName(shortName);
    if (!emojiUrl) {
        return (
            <NativeEmojiInlineText decoratedText={decoratedText}>
                {children}
            </NativeEmojiInlineText>
        );
    }

    const backgroundImage = `url(${emojiUrl})`;
    const combinedClassName = classnames("emoji", className, "emojiInline", "notranslate");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const emojiRef = React.useRef(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [fontSize, setFontSize] = React.useState();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const maybeDetectFontSize = React.useCallback(() => {
        if (emojiRef.current) {
            const prevSibling = emojiRef.current.previousSibling;
            const nextSibling = emojiRef.current.nextSibling;
            const prevSiblingFontSize = prevSibling && prevSibling.style.fontSize;
            const nextSiblingFontSize = nextSibling && nextSibling.style.fontSize;
            if (prevSiblingFontSize === nextSiblingFontSize ||
                prevSiblingFontSize && !nextSiblingFontSize ||
                !prevSiblingFontSize && nextSiblingFontSize) {
                setFontSize(prevSiblingFontSize || nextSiblingFontSize);
            }
        }
    }, [emojiRef]);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useLayoutEffect(() => {
        maybeDetectFontSize();
    })

    return (
        <span
            ref={emojiRef}
            className={combinedClassName}
            title={decoratedText}
            style={{ backgroundImage, fontSize }}
        >
            {children}
        </span>
    );
}
