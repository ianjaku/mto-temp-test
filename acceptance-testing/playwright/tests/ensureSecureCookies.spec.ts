import { EnsureSecureCookies } from "../scenarios/ensureSecureCookies";
import { runTests } from "../fixtures";

const tests = {
    "ensure secure cookies": async ({ browser, testData }) => {
        const setupTestCase = new EnsureSecureCookies(browser, testData);
        await setupTestCase.run();
    }
}

runTests("Ensure secure cookies", tests, "singleDocHierarchy");
