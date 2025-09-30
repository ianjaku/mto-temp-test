export interface IFileWithCommentsHeaders {
    commentHeaders: string;
    rest: string;
    lineCount: number;
}


export function splitFile(fullFile: string): IFileWithCommentsHeaders {
    const lines = fullFile.split("\n");
    const headers = [];
    const rest = [];
    let i;
    for (i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line === "") {
            continue;
        }
        if (line.startsWith("/*")) {
            do {
                line = lines[i].trim();
                headers.push(line);
                i++;
            } while (i < lines.length && !line.endsWith("*/"));
            i--;
            continue;
        }
        if (line.startsWith("//")) {
            headers.push(line);
            continue;
        }
        break;
    }
    for (let j = i; j < lines.length; j++) {
        rest.push(lines[j]);
    }
    return {
        commentHeaders: headers.join("\n"),
        rest: rest.join("\n"),
        lineCount: lines.length
    };
}
