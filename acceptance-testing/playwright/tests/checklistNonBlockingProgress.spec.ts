import { ChecklistAllNonBlockingProgress, ChecklistSomeNonBlockingProgress } from "../scenarios/checklistNonBlockingProgress";
import { DEFAULT_ITEM_HIERARCHY } from "../../config/boilerplate/constants";
import { runTests } from "../fixtures";

const tests = {
    "non-blocking checklist progress when all chunks are checks": async ({ browser, testData }) => {
        const setupTestCase = new ChecklistAllNonBlockingProgress(browser, testData);
        await setupTestCase.run();
    },
    "non-blocking checklist progress when some chunks are checks": async ({ browser, testData }) => {
        const setupTestCase = new ChecklistSomeNonBlockingProgress(browser, testData);
        await setupTestCase.run();
    }
};

runTests("Non-Blocking checklist progress", tests, DEFAULT_ITEM_HIERARCHY, "checklistNonBlocking");
