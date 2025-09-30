export function stripHTML(text: string): string {
    return typeof text === "string" ? text.replace(/<(?:.|\n)*?>/gm, "") : "";
}

export function countWordsInHtml(html: string): number {
    return stripHTML(html).split(/[\s.(),]+/).filter(w => !!w).length;
}