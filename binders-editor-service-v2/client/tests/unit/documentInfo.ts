import Binder, { createNewBinder, update } from "@binders/client/lib/binders/custom/class";
import { buildDocumentInfo } from "../../src/documents/Composer/helpers/binder";
import { patchAddTranslation } from "@binders/client/lib/binders/patching";
import { updateRichTextChunk } from "@binders/client/lib/binders/editing";

/*
    Note: if running the unit tests results in following error:
    `Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.`
    It's possible there's a js(x) file somewhere in the import tree
    One possible fix is to convert the file to ts(x)
*/

describe("Document info", () => {
    it("should have correct initial flags", () => {
        const binder = createNewBinder(
            "testBinder",
            "en",
            "aid-test",
            1
        );
        const documentInfo = buildDocumentInfo(binder, "en");
        expect(documentInfo.documentHasVisuals).toEqual(false);
        expect(documentInfo.isTitleTextEmpty).toEqual(false);
        expect(documentInfo.titleModuleSet.isEmpty).toEqual(false);
    });

    it("should detect chunk 1 vs title equality", () => {
        const binder = createNewBinder(
            "testBinder",
            "en",
            "aid-test",
            1
        );
        let documentInfo = buildDocumentInfo(binder, "en");
        expect(documentInfo.chunk1EqualsTitle).toEqual(false);
        const patchFn = (binder: Binder) => updateRichTextChunk(binder, "t1", 0, ["<p>testBinder</p>"], undefined, "");
        const updatedBinder = update(binder, patchFn, false);
        documentInfo = buildDocumentInfo(updatedBinder, "en");
        expect(documentInfo.chunk1EqualsTitle).toEqual(true);
    });

    it("isEmpty flag of moduleSet in single language scenario", () => {
        const binder = createNewBinder(
            "testBinder",
            "en",
            "aid-test",
            1
        );
        let documentInfo = buildDocumentInfo(binder, "en");
        expect(documentInfo.moduleSets[0].isEmpty).toEqual(true);
        const patchFn = (binder: Binder) => updateRichTextChunk(binder, "t1", 0, ["<p>chunk 1</p>"], undefined, "");
        const updatedBinder = update(binder, patchFn, false);
        documentInfo = buildDocumentInfo(updatedBinder, "en");
        expect(documentInfo.moduleSets[0].isEmpty).toEqual(false);
    });

    it("isEmpty and isEmptyAcrossLanguages of moduleSet in multiple languages scenario", () => {
        let binder = createNewBinder(
            "testBinder",
            "en",
            "aid-test",
            1
        );
        let patchFn = (binder: Binder) => updateRichTextChunk(binder, "t1", 0, ["<p>chunk 1</p>"], undefined, "");
        binder = update(binder, patchFn, false);
        patchFn = (binder: Binder) => [patchAddTranslation(binder, "t2", "fr", "", "i1", "testBinder FR")];
        binder = update(binder, patchFn, false);
        let documentInfo = buildDocumentInfo(binder, "fr");
        expect(documentInfo.moduleSets[0].isEmpty).toEqual(true);
        expect(documentInfo.moduleSets[0].isEmptyAcrossLanguages).toEqual(false);
        patchFn = (binder: Binder) => updateRichTextChunk(binder, "t2", 0, ["<p>chunk 1 FR</p>"], undefined, "");
        binder = update(binder, patchFn, false);
        documentInfo = buildDocumentInfo(binder, "fr");
        expect(documentInfo.moduleSets[0].isEmpty).toEqual(false);
    });
});