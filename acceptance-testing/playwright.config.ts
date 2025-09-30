import { PlaywrightTestConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */

const junitReporter = ["junit", { outputFile: "test-reports/junit.xml" }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reporter: any = process.env.RUNS_IN_PIPELINE ?
    [junitReporter] :
    [
        junitReporter,
        ["html"]
    ];


const CHROMEPROJECT = {
    name: "chrome",
    use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
    },
};

const FIREFOXPROJECT = {
    name: "firefox",
    use: {
        ...devices["Desktop Firefox"],
        channel: "firefox",
    }
};

const EDGEPROJECT = {
    name: "edge",
    use: {
        ...devices["Desktop Edge"],
        channel: "msedge"
    },
};

// Branches that will run cross-browser tests
// Be sure to use the shortened branch name (see function shortenBrancheName in k8s.ts)
const CROSSBROWSER_BRANCHES = [
    "develop",
    "no-issue-pw-reset-no-logout"
];


function getProjects() {
    if (CROSSBROWSER_BRANCHES.includes(process.env.BITBUCKET_BRANCH)) {
        return [
            CHROMEPROJECT,
            FIREFOXPROJECT,
            EDGEPROJECT
        ];
    }
    return [
        CHROMEPROJECT
    ];
}

export const PLAYWRIGHT_TIMEOUT_DEFAULT = 30_000;
export const PLAYWRIGHT_TIMEOUT_2X = 2 * PLAYWRIGHT_TIMEOUT_DEFAULT;

const config: PlaywrightTestConfig = {
    testDir: "./playwright/tests",
    /* Maximum time one test can run for. */
    timeout: 10 * 60 * 1000,
    expect: {
        /**
         * Maximum time expect() should wait for the condition to be met.
         * For example in `await expect(locator).toHaveText();`
         */
        timeout: PLAYWRIGHT_TIMEOUT_DEFAULT,
    },
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 2 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter,
    /* Where to look for snapshots, used by eg. expectToHaveSnapshot() */
    snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
        actionTimeout: PLAYWRIGHT_TIMEOUT_DEFAULT,
        /* Base URL to use in actions like `await page.goto('/')`. */
        // baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: "retain-on-failure",
        // launchOptions: {
        //     executablePath: "<path-to-chrome-binary>"
        //     slowMo: 800,
        // }
    },
    /* Configure projects for major browsers */
    projects: getProjects(),

    /* Folder for test artifacts such as screenshots, videos, traces, etc. */
    // outputDir: 'test-results/',

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   port: 3000,
    // },
};

export default config;
