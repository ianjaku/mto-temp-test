import { RecursiveActions } from "../scenarios/recursiveActions";
import { runTests } from "../fixtures";

const tests = {
    "recursive actions": async ({ browser, testData }) => {
        const setupTestCase = new RecursiveActions(browser, testData);
        await setupTestCase.run();
    }
}

runTests(
    "Recursive actions",
    tests,
    "readScopeHierarchy",
    "recursiveActions"
);
