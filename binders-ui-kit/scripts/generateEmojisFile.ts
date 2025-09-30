import * as emojis from "./emojis.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as fs from "fs";

const dir = fs.opendirSync("../public/svg")
let file;
let result = "";
while ((file = dir.readSync()) !== null) {
    const unicode = file.name.split(".")[0];
    const emojiObject = emojis[unicode];
    if (emojiObject) {
        result = result + `\n"${emojiObject.shortname}": { unicode: "${unicode}" },`
    }
}
// eslint-disable-next-line no-console
console.log(result);
dir.closeSync()