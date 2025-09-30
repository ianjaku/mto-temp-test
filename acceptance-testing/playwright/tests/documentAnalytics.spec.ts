import { DocumentAnalytics } from "../scenarios/documentAnalytics";
import { runTests } from "../fixtures";

const tests = {
    "document analytics": async ({ browser, testData }) => {
        const testCase = new DocumentAnalytics(browser, testData);
        await testCase.run();
    }
}

runTests("document analytics", tests, "multilingualDocHierarchy");
