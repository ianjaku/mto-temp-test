import { CreateNewDocument } from "../scenarios/createNewDocument";
import { runTests } from "../fixtures";

const tests = {
    "simple first": async ({ browser, testData }) => {
        const testCase = new CreateNewDocument(browser, testData);
        await testCase.run();
    }
}

runTests("create new document", tests);
