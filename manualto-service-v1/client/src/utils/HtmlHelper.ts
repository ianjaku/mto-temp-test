export const countWords: (html: string | string[]) => number = (html) => {
    const element = document.createElement("div");
    element.innerHTML = Array.isArray(html) ? html.join(" ") : html;
    const text = element.textContent || element.innerText;

    // eslint-disable-next-line no-useless-escape
    const words = text.split(/[\s\.\(\),]+/);
    return words.length === 1 && words[0].trim() === "" ? 0 : words.length;
};
