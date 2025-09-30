export interface ParsedWord {
    text: string;
    offsetInOriginal: number;
}

export interface ParsedHtml {
    words: ParsedWord[];
}
function splitWords (wordsAsString: string): ParsedWord[] {
    const parts = wordsAsString.split(/\s/);
    const result = [];
    let offsetInOriginal = 0;
    for (let i=0; i<parts.length; i++) {
        const text = parts[i];
        if (text.length === 0) {
            offsetInOriginal += 1;
            continue;
        }
        result.push({
            text,
            offsetInOriginal
        });
        offsetInOriginal += 1 + text.length;
    }
    return result;
}

function addWords(parsed: ParsedHtml, wordsAsString: string, offset: number): ParsedHtml {
    if (wordsAsString.length === 0) {
        return parsed;
    }
    const words = splitWords(wordsAsString);
    for (const word of words) {
        parsed.words.push({
            text: word.text,
            offsetInOriginal: word.offsetInOriginal + offset
        });
    }
    return parsed;
}

export function parseHtml(html: string): ParsedHtml {
    let offset = 0;
    const parsedHtml = { words: [] }
    do {
        const tail = html.substr(offset);
        const matches = tail.match(/^([^<]*)<[^>]+>/u);
        if (!matches) {
            addWords(parsedHtml, tail, offset);
            break;
        }
        addWords(parsedHtml, matches[1], offset);
        const tag = matches[0];
        offset += tag.length;
    // eslint-disable-next-line no-constant-condition
    } while(true);
    return parsedHtml;
}
