import { Access } from "../scenarios/access";
import { runTests } from "../fixtures";

const tests = {
    "setup": async ({ browser, testData }) => {
        const setupTestCase = new Access(browser, testData);
        await setupTestCase.run();
    }
}

runTests(
    "Access",
    tests,
);
