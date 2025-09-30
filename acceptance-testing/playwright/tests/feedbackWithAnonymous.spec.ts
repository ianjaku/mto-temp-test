import { BinderNotLoggedInFeedback } from "../scenarios/feedbackNotLoggedIn";
import { BinderUserFeedbackWithAnonymous } from "../scenarios/feedbackWithAnonymous";
import { runTests } from "../fixtures";

const testsWithAnonymous = {
    "binder user feedback with anonymous": async ({ browser, testData }) => {
        const setupTestCase = new BinderUserFeedbackWithAnonymous(browser, testData);
        await setupTestCase.run();
    },
    "binder not logged in feedback": async ({ browser, testData }) => {
        const setupTestCase = new BinderNotLoggedInFeedback(browser, testData);
        await setupTestCase.run();
    }
};

runTests("Reader Feedback with Anonymous", testsWithAnonymous, "feedbackHierarchy", "feedbackAnonymous");
