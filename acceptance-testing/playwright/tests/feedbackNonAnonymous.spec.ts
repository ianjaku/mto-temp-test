import { BinderUserFeedbackNonAnonymous } from "../scenarios/feedbackNonAnonymous";
import { runTests } from "../fixtures";

const testsNonAnonymous = {
    "binder user feedback non anonymous": async ({ browser, testData }) => {
        const setupTestCase = new BinderUserFeedbackNonAnonymous(browser, testData);
        await setupTestCase.run();
    },
};

runTests("Reader Feedback Non-Anonymous", testsNonAnonymous, "feedbackHierarchy", "feedbackNonAnonymous");
