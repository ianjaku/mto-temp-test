import data from "./emojis";
import { toShort } from "emoji-toolkit";

export interface EmojiStrategy {
    [x: string]: {
        [x: string]: string[];
    };
}

export default function createEmojisFromStrategy(): EmojiStrategy {
    const emojis: EmojiStrategy = {};

    for (const item of data) {
        const shortName = toShort(item["unicode"]);
        const emoji = data.get(shortName);
        if (emoji) {
            if (!emojis[emoji.category]) {
                emojis[emoji.category] = {};
            }
            emojis[emoji.category][shortName] = [shortName];
        }
    }
    return emojis;
}
