import emojiToolkit from "./emojis";

interface EmojiListObject {
    [s: string]: string[];
}

interface EmojiList {
    setPriorityList(newPriorityList: EmojiListObject): void;
    list: EmojiListObject;
}

function newEmojiListWithOutPriorityList(
    priorityList: EmojiListObject
): EmojiListObject {
    const list: EmojiListObject = {};
    for (const key in emojiToolkit.emojiList) {

        // eslint-disable-next-line no-prototype-builtins
        if (priorityList.hasOwnProperty(key)) {
            continue;
        }

        list[key] = [emojiToolkit.emojiList[key].unicode];
    }

    return { ...priorityList, ...list };
}

const emojiList: EmojiList = {
    setPriorityList(newPriorityList) {
        this.list = newEmojiListWithOutPriorityList(newPriorityList);
    },
    list: {},
};

// left for maybe future extensiosns
const priorityList: EmojiListObject = {
    ":thumbsup:": ["1f44d"],
    ":smile:": ["1f604"],
    ":heart:": ["2764-fe0f", "2764"],
    ":ok_hand:": ["1f44c"],
    ":joy:": ["1f602"],
    ":tada:": ["1f389"],
    ":see_no_evil:": ["1f648"],
    ":raised_hands:": ["1f64c"],
    ":100:": ["1f4af"],
};
emojiList.setPriorityList(priorityList);

export default emojiList;
