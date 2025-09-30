import { EditorSearchWithLanguageRestrictions } from "../scenarios/editorSearchWithLanguageRestrictions";
import { runTests } from "../fixtures";

const tests = {
    "simple first": async ({ browser, testData }) => {
        const testCase = new EditorSearchWithLanguageRestrictions(browser, testData);
        await testCase.run();
    }
}

runTests("Searching in the editor", tests, "documentsWithDialects");
