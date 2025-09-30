import { UsergroupOwners } from "../scenarios/usergroupOwners";
import { runTests } from "../fixtures";

const tests = {
    "Usergroup owners": async ({ browser, testData }) => {
        const testcase = new UsergroupOwners(browser, testData);
        await testcase.run();
    }
}

runTests(
    "Usergroup owners",
    tests,
    "usergroupOwners",
    "usergroupOwners",
);
