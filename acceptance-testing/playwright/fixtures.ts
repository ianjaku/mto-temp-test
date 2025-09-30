import { Browser, Fixtures, test as baseTest } from "@playwright/test";
import {
    DEFAULT_ACCOUNT_USER_SPEC,
    DEFAULT_ITEM_HIERARCHY
} from  "../config/boilerplate/constants";
import { ItemHierarchy, TestData } from "../config/boilerplate/contract";
import { BrowserWindow } from "./sections/browserwindow";
import { seedData } from "../config/boilerplate";

export interface ExtraFixtures {
    itemHierarchyName?: string,
    accountUserSpecName?: string,
    testData: Fixtures,
}

const headless = !!process.env.RUNS_IN_PIPELINE;
const test = baseTest.extend<ExtraFixtures>({
    itemHierarchyName: undefined,
    accountUserSpecName: undefined,
    headless,
    testData: async ({ itemHierarchyName, accountUserSpecName }, use) => {
        const testData = await seedData(itemHierarchyName, accountUserSpecName);
        await use(testData);
    }
});

export abstract class TestCase {

    constructor(
        protected readonly browser: Browser,
        protected readonly testData: TestData
    ) {}

    abstract run(): Promise<void>;

    async createBrowserWindow(): Promise<BrowserWindow> {
        return await BrowserWindow.create(this.browser, this.testData);
    }
}

export type TestFunction = (fixtures: Fixtures) => Promise<void>;
export type DataHierarchyExtractor = (testdata: TestData) => ItemHierarchy;

/**
 * @deprecated Use pwTest instead
 */
export function runTests(
    suiteName: string,
    fs: Record<string, TestFunction>,
    itemHierarchyName = DEFAULT_ITEM_HIERARCHY,
    accountUserSpecName = DEFAULT_ACCOUNT_USER_SPEC,
): void {
    test.use({ itemHierarchyName })
    test.use({ accountUserSpecName })
    test.describe(suiteName, () => {
        for (const k of Object.keys(fs)) {
            test(k, fs[k]);
        }
    });
}
