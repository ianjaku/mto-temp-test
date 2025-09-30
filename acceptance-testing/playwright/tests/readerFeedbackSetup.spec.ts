import { ReaderFeedbackSettingsDirtyState, ReaderFeedbackSetup } from "../scenarios/readerFeedbackSetup";
import { runTests } from "../fixtures";

const tests = {
    "Reader feedback: setup in editor": async ({ browser, testData }) => {
        const testcase = new ReaderFeedbackSetup(browser, testData);
        await testcase.run();
    },
    "Reader feedback settings: dirty state": async ({ browser, testData }) => {
        const testcase = new ReaderFeedbackSettingsDirtyState(browser, testData);
        await testcase.run();
    }
}

runTests(
    "Readerfeedback setup",
    tests,
    "readerFeedbackSetupHierarchy",
    "readerFeedbackSetup",
);
