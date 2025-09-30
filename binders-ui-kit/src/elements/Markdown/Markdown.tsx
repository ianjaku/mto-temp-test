import * as React from "react";

type MarkdownProps = {
    element: string;
    children: string;
    className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ children, element, className }) => {
    const lines = children.split(/<br\s*\/?>|\n/);
    const fragments: React.ReactNode[] = [];
    let lineIdx = 0;

    while (lineIdx < lines.length) {
        const line = lines[lineIdx];
        if (parseUnorderedList(line) != null) {
            const listItems: React.ReactNode[] = [];
            let listItem: string | null = null;
            let listItemIdx = 0;
            while (lineIdx < lines.length && (listItem = parseUnorderedList(lines[lineIdx])) != null) {
                listItems.push(<li key={`${lineIdx}-${listItemIdx}`}>{parseLine(listItem)}</li>);
                lineIdx += 1;
                listItemIdx += 1;
            }
            fragments.push(<ul key={`ul-${lineIdx}`}>{listItems}</ul>)
        } else {
            const isHeader = line.trim().startsWith("#");
            const addBr = lineIdx < lines.length - 1 && !isHeader;
            fragments.push(
                <React.Fragment key={lineIdx}>
                    {parseLine(line)}
                    {addBr && <br />}
                </React.Fragment>
            )
            lineIdx += 1;
        }
    }

    return React.createElement(element, { className }, fragments);
};

function parseUnorderedList(line: string): string | null {
    const ulRegex = /^\s*-\s+(.*)/;
    const match = ulRegex.exec(line);
    return match && match[1];
}

const strongRegex = /\*\*(.+?)\*\*/;
const emRegex = /\*([^*]+?)\*/;
const h1Regex = /^\s*#\s+(.*)/;
const h2Regex = /^\s*##\s+(.*)/;
const h3Regex = /^\s*###\s+(.*)/;
const h4Regex = /^\s*####\s+(.*)/;
const h5Regex = /^\s*#####\s+(.*)/;

function parseLine(line: string): React.ReactNode {
    let match: RegExpExecArray | null = null;

    if ((match = h1Regex.exec(line))) return <h1>{match[1]}</h1>;
    if ((match = h2Regex.exec(line))) return <h2>{match[1]}</h2>;
    if ((match = h3Regex.exec(line))) return <h3>{match[1]}</h3>;
    if ((match = h4Regex.exec(line))) return <h4>{match[1]}</h4>;
    if ((match = h5Regex.exec(line))) return <h5>{match[1]}</h5>;

    const parts: React.ReactNode[] = [];
    let index = 0;

    const processMatch = (match: RegExpExecArray, tag: string) => {
        if (match.index > 0) {
            parts.push(match.input.slice(0, match.index))
        }
        parts.push(React.createElement(tag, { key: index }, match[1]));
        index += match.index + match[0].length;
    };

    while (index < line.length) {
        const slice = line.slice(index);
        if ((match = strongRegex.exec(slice)) !== null) {
            processMatch(match, "strong");
        } else if ((match = emRegex.exec(slice)) !== null) {
            processMatch(match, "em");
        } else {
            index += slice.length;
            parts.push(slice);
        }
    }

    return <>{parts}</>
}
