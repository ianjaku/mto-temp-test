import { parseHtml } from "../../../src/parsers/html";

function scenario(html, expected) {
    const parsedWords = parseHtml(html);
    let matches = 0;
    for (const parsedWord of parsedWords.words) {
        const start = parsedWord.offsetInOriginal;
        const end = start + parsedWord.text.length;
        const fromOriginal = html.substring(start, end);
        expect(fromOriginal).toEqual(parsedWord.text);
        expect(parsedWord.text).toEqual(expected[matches]);
        matches += 1;
    }
}
it("full html", () => {
    const html = "<html><body><h1>Pagina title</h1><br/><p>Daar gaan we </p></body></html>";
    const expected = [
        "Pagina",
        "title",
        "Daar",
        "gaan",
        "we"
    ];
    scenario(html, expected);
});


it("full html multiple spaces", () => {
    const html = "<html><body><h1>Pagina   title   </h1><br/><p>   Daar gaan we </p></body></html>";
    const expected = [
        "Pagina",
        "title",
        "Daar",
        "gaan",
        "we"
    ];
    scenario(html, expected);
});

it("full html (head + tail)", () => {
    const html = "head <html><body><h1>Pagina title</h1><br/><p>Daar gaan we </p></body></html> tail ";
    const expected = [
        "head",
        "Pagina",
        "title",
        "Daar",
        "gaan",
        "we",
        "tail"
    ];
    scenario(html, expected);
});

it("html snippit (img)", () => {
    const html = "<img src=\"https://fake.me/test.jpg\" />something text";
    const expected = [
        "something",
        "text"
    ];
    scenario(html, expected);
})

it("html snippit (a)", () => {
    const html = "<a href=\"https://fake.me/test.jpg\">something text</a>";
    const expected = [
        "something",
        "text"
    ];
    scenario(html, expected);
})

it("html snippit (span)", () => {
    const html = "<span style=\"color:red;\">something</span> text";
    const expected = [
        "something",
        "text"
    ];
    scenario(html, expected);
})

it("html snippit (unicode)", () => {
    const html = "Ω <span>Ω - α</span>Ω ";
    const expected = [
        "Ω",
        "Ω",
        "-",
        "α",
        "Ω"
    ];
    scenario(html, expected);
})