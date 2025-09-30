import { ErrorReasons, InvalidEditorLoginErrorReason, InvalidReaderLoginErrorReason, NoErrorOnFirstVisitToLogin } from "../scenarios/errorReasons";
import { runTests } from "../fixtures";

const tests = {
    "make sure correct error reasons are displayed": async ({ browser, testData }) => {
        const testCase = new ErrorReasons(browser, testData);
        await testCase.run();
    },
    "editor - given incorrect credentials, fails with a correct reason": async ({ browser, testData }) => {
        const testCase = new InvalidEditorLoginErrorReason(browser, testData);
        await testCase.run();
    },
    "reader - given incorrect credentials, fails with a correct reason": async ({ browser, testData }) => {
        const testCase = new InvalidReaderLoginErrorReason(browser, testData);
        await testCase.run();
    },
    "editor - does not show any error when anonymous visits /login": async ({ browser, testData }) => {
        const testCase = new NoErrorOnFirstVisitToLogin(browser, testData);
        await testCase.run();
    },
}

runTests("Error reasons", tests, "blankHierarchy");
