import { HTMLTreeIterator, mergeChunks, splitChunks } from "../../../src/parsers/htmlSplitter";
import { appendChild, createDocumentFragment } from "parse5/lib/tree-adapters/default";
import { parseFragment, serialize } from "parse5";

const htmlGt5k = `<h1>Schoonmaakproducten</h1>
<ol>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=1">Activ Tabs</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=2">Apesin Swiftr</a>r</li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=4">Brilliant Perfect</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=6">Brilliant Ultra (Tana)</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=8">Cream Cleanerc</a>c</li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=10">Energy Dishtab</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=12">E)nergy UNI (Tana</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=14">Grease off Quick &amp; Easy</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=16">Schoon- maak azijn</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=18">Sanet Zitrotann</a>n</li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=20">Karacho</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=22">awip Vioclean</a></li>
  <li><a href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=24">WC lemon</a><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=1">Activ Tabs</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=2">Apesin Swift</a><a href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=3">r</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=4">Brilliant Perfect</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=6">Brilliant Ultra (Tana)</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=8">Cream Cleaner</a><a href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=9">c</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=10">Energy Dishtabs</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=12">Energy UNI (Tana)</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=14">Grease off Quick &amp; Easy</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=16">Schoon- maak azijn</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=18">Sanet Zitrotan</a><a href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=19">n</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=20">Tanet Karacho</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=22">Tawip Vioclean</a></li>
  <li><a target="_self" href="https://stadgentintern.manual.to/launch/AXA7A7N9HBzAAE49XtY5/AXA7P8a8HOIPoN2DiqKS/AXCwYuAAHBzAAE49Xud6?previewChunk=24">WC lemon</a></li>
</ol>
<p><br></p>
<p><strong>lukken: Neem contact op met een arts of spoedeisende hulp - neem het etiket of dit veiligheidsblad mee. Bij aanhoudende symptomen of twijfel over de toestand van het slachtoffer moet er een arts ingeschakeld worden. Geef een bewusteloze persoon nooit water of iets dergelijks. Nummer antigifcentrum : 070/245.245</strong></p>
<p>Simpel textje</p>`;

function assertEqualHtml(element, expected) {
    const fragment = createDocumentFragment();
    appendChild(fragment, element);
    const serialized = serialize(fragment);
    expect(serialized).toEqual(expected);
}

it("Simple iterator", () => {
    const html = "<p class=\"p1\">P1</p><p>P2</p><p>P3</p>";
    const fragment = parseFragment(html);
    const iterator = new HTMLTreeIterator([{ node: fragment, childIndex: 0}]);
    const items = [];
    do {
        const item = iterator.current();
        const fragment = createDocumentFragment();
        appendChild(fragment, item);
        items.push(serialize(fragment));
        iterator.next();
    } while (iterator.hasMoreLeafs());
    expect(items).toEqual(["<p class=\"p1\" mpa=\"0\">P1</p>", "<p mpa=\"1\">P2</p>", "<p mpa=\"2\">P3</p>"])
});


it("Descend + ascend", () => {
    const html = "<section><h1>Title</h1>This is a text node</section><section><h1>Second title</h1>And another text node</section>";
    const fragment = parseFragment(html);
    const iterator = new HTMLTreeIterator([{ node: fragment, childIndex: 0}]);
    iterator.descend();
    const title1 = iterator.current();
    assertEqualHtml(title1, "<h1 mpa=\"0.0\">Title</h1>");
    iterator.next();
    const text1 = iterator.current();
    assertEqualHtml(text1, "This is a text node");
    iterator.ascend();
    iterator.next();
    iterator.descend();
    const title2 = iterator.current();
    assertEqualHtml(title2, "<h1 mpa=\"1.0\">Second title</h1>");
    iterator.next();
    const text2 = iterator.current();
    assertEqualHtml(text2, "And another text node");
});


it("Split in two simple chunks", () => {
    const html = "<div><section><h1>Title</h1>This is a text node</section><section><h1>Second title</h1>And another text node</section></div>";
    const options = {
        maxChunkSize: 64,
    }
    const chunks = splitChunks(html, options);
    expect(chunks).toEqual([
        "<div mpa=\"0\"><section mpa=\"0.0\"><h1>Title</h1>This is a text node</section></div>",
        "<div mpa=\"0\"><section mpa=\"0.1\"><h1>Second title</h1>And another text node</section></div>"
    ])
});

it("Splits a list correctly", () => {
    const html = "<div><h1>Some title</h1><div><ul><li>item 1</li><li>item 2</li><li>item 3</li></ul></div></div>";
    const options = {
        maxChunkSize: 70,
    }
    const chunks = splitChunks(html, options);
    expect(chunks).toEqual([
        "<div mpa=\"0\"><h1 mpa=\"0.0\">Some title</h1></div>",
        "<div mpa=\"0\"><div mpa=\"0.1\"><ul mpa=\"0.1.0\"><li mpa=\"0.1.0.0\">item 1</li></ul></div></div>",
        "<div mpa=\"0\"><div mpa=\"0.1\"><ul mpa=\"0.1.0\"><li mpa=\"0.1.0.1\">item 2</li></ul></div></div>",
        "<div mpa=\"0\"><div mpa=\"0.1\"><ul mpa=\"0.1.0\"><li mpa=\"0.1.0.2\">item 3</li></ul></div></div>"
    ])
});

it("Merges chunks correctly", () => {
    const options = {
        maxChunkSize: 1000
    };
    const chunks = splitChunks(htmlGt5k, options);
    expect(chunks.length).toEqual(8);
    expect(htmlGt5k).toEqual(mergeChunks(chunks));
})