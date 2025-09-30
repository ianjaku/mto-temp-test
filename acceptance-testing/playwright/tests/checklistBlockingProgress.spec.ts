import { ChecklistAllBlockingProgress, ChecklistSomeBlockingProgress } from "../scenarios/checklistBlockingProgress";
import { DEFAULT_ITEM_HIERARCHY } from "../../config/boilerplate/constants";
import { runTests } from "../fixtures";

const tests = {
    "blocking checklist progress when all chunks are checks": async ({ browser, testData }) => {
        const setupTestCase = new ChecklistAllBlockingProgress(browser, testData);
        await setupTestCase.run();
    },
    "blocking checklist progress when some chunks are checks": async ({ browser, testData }) => {
        const setupTestCase = new ChecklistSomeBlockingProgress(browser, testData);
        await setupTestCase.run();
    },
};

runTests("Blocking checklist progress", tests, DEFAULT_ITEM_HIERARCHY, "checklistBlocking");

