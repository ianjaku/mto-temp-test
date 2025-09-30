import * as emojiToolkit from "emoji-toolkit";
import { ContentBlock } from "draft-js";
import findWithRegex from "find-with-regex";

const escapedFind = emojiToolkit.escapeRegExp(emojiToolkit.unicodeCharRegex());
const search = new RegExp(
    `<object[^>]*>.*?</object>|<span[^>]*>.*?</span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|(${escapedFind})`,
    "gi"
);

export default (
    contentBlock: ContentBlock,
    callback: StrategyCallback
): void => {
    findWithRegex(search, contentBlock, callback);
};
