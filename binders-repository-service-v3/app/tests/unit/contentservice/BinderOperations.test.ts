import { BinderOperations, createBinder } from "../../../src/contentservice/internal/BinderOperations";

describe("BinderOperations", () => {
    describe("changeTitle", () => {
        it("changes a title", async () => {
            const binder = createBinder({
                title: "Foo",
                accountId: "xxx",
                languageCode: "en",
                chunkMarkdowns: [],
            })
            const ops = BinderOperations.fromClassObject(binder);
            expect(
                ops.changeTitle(0, "Foo Bar")
                    .toClassObject()
                    .getTitle("en")
            ).toBe("Foo Bar")
        });
    });

    describe("chunkToMarkdown", () => {
        it("returns markdown of a chunk", async () => {
            const binder = createBinder({
                title: "Foo",
                accountId: "xxx",
                languageCode: "en",
                chunkMarkdowns: ["**Foo** Bar"],
            })
            const ops = BinderOperations.fromClassObject(binder);
            expect(ops.chunkToMarkdown(0, 1)).toBe("**Foo** Bar")
        });
    });

    describe("replaceChunkWithMarkdown", () => {
        it("replaces the chunks", async () => {
            const binder = createBinder({
                title: "Foo",
                accountId: "xxx",
                languageCode: "en",
                chunkMarkdowns: ["**Foo** Bar"],
            })
            const ops = BinderOperations.fromClassObject(binder);
            const replaced = ops.replaceChunkWithMarkdown(0, 1, "Foo **Bar**").toClassObject()
            expect(
                replaced.getTextModuleChunksByLanguageAndChunkIndex(0, 1)
            ).toStrictEqual(["<p>Foo <strong>Bar</strong></p>"])
        });
        it("replaces the editorStates", async () => {
            const binder = createBinder({
                title: "Foo",
                accountId: "xxx",
                languageCode: "en",
                chunkMarkdowns: ["**Foo** Bar"],
            })
            const ops = BinderOperations.fromClassObject(binder);
            expect(JSON.parse(
                ops.replaceChunkWithMarkdown(0, 1, "Foo **Bar**")
                    .toClassObject()
                    .getTextModuleEditorStateByLanguageAndChunkIndex(0, 1)
            )).toMatchObject({
                "blocks": [{
                    "data": {},
                    "depth": 0,
                    "entityRanges": [],
                    "inlineStyleRanges": [{ "length": 3, "offset": 4, "style": "BOLD" }],
                    "text": "Foo Bar",
                    "type": "unstyled",
                }],
                "entityMap": {},
            })
        });
    });

    describe("toMarkdown", () => {
        it("returns markdown of the Binder", async () => {
            const binder = createBinder({
                title: "Foo",
                accountId: "xxx",
                languageCode: "en",
                chunkMarkdowns: ["**Foo** Bar", "Bar **Baz**"],
            })
            const ops = BinderOperations.fromClassObject(binder);
            expect(ops.toMarkdown(0)).toBe(`# Foo

---
**Foo** Bar

---
Bar **Baz**`)
        });
    });
});
