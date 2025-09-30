import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CreateUserParams,
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import {
    LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP,
    LDFlags
} from "@binders/client/lib/launchdarkly/flags";
import { Page, TestInfo, test as playwrightTest } from "@playwright/test";
import { bold, box } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EditorSections } from "./sections/editor/editorsections";
import { IFeature } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ItemTree } from "@binders/binders-service-common/lib/testutils/fixtures/itemfactory";
import { ManageSections } from "./sections/manage/sections";
import { ReaderSections } from "./sections/reader/readersections";
import { ServiceLocations } from "../config/boilerplate/contract";
import {
    TestAccountFactory
} from "@binders/binders-service-common/lib/testutils/fixtures/accountfactory";
import {
    TestAccountFixtures
} from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import UUID from "@binders/client/lib/util/uuid";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { basename } from "path";
import { deleteTestAccounts } from "@binders/binders-service-common/lib/testutils/cleanup";
import { loadConfigJSON } from "../config/boilerplate/helpers";

type CreateWindow = () => Promise<BrowserWindow>;

class BrowserWindow {
    constructor(
        public readonly page: Page,
        private readonly serviceLocations: ServiceLocations,
        private readonly domain: string
    ) { }

    async openReader(relativeUrl = "", domain?: string): Promise<ReaderSections> {
        const url = new URL(relativeUrl, this.serviceLocations.reader);
        url.searchParams.append("domain", domain || this.domain);
        await this.page.goto(url.toString());
        return new ReaderSections({
            page: this.page,
            editorUrl: this.serviceLocations.editor,
            readerUrl: this.serviceLocations.reader,
        });
    }

    async openReaderAsUser(login: string, password: string): Promise<ReaderSections> {
        const reader = await this.openReader("/login");
        await reader.login.loginWithEmailAndPass(login, password);
        return reader;
    }

    async openEditor(relativeUrl = ""): Promise<EditorSections> {
        await this.goto(relativeUrl);
        return new EditorSections({
            page: this.page,
            editorUrl: this.serviceLocations.editor,
            readerUrl: this.serviceLocations.reader,
        });
    }

    async openManage(relativeUrl = ""): Promise<ManageSections> {
        if (!this.serviceLocations.manage?.length) {
            throw Error("Key `manage` is missing in `serviceLocations`. Add `\"manage\": \"http://dockerhost:30008\"` to `acceptance-testing/config/serviceLocations.json`");
        }
        const url = new URL(relativeUrl, this.serviceLocations.manage);
        await this.page.goto(url.toString());
        return new ManageSections({
            page: this.page,
            manageUrl: this.serviceLocations.manage,
            editorUrl: this.serviceLocations.editor,
            readerUrl: this.serviceLocations.reader,
        });
    }

    async goto(relativeUrl = "") {
        const url = new URL(relativeUrl, this.serviceLocations.editor);
        await this.page.goto(url.toString());
    }

    async gotoReaderLink(relativeUrl = "", domain?: string) {
        const url = new URL(relativeUrl, this.serviceLocations.reader);
        url.searchParams.append("domain", domain || this.domain);
        await this.page.goto(url.toString());
    }

    async openEditorAsUser(login: string, password: string, skipCookieBannerDecline = false): Promise<EditorSections> {
        const editor = await this.openEditor("/login");
        await editor.login.loginWithEmailAndPass(login, password);
        if (!skipCookieBannerDecline) {
            await editor.cookieBanner.declineCookies();
        }
        return editor;
    }

    getPage(): Page {
        return this.page;
    }

    close(): Promise<void> {
        return this.page.close();
    }

    /* eslint-disable no-console */
    async overrideLaunchDarklyFlag(flag: LDFlags, value: unknown): Promise<void> {
        console.log(`Overriding LaunchDarkly flag '${flag}' to value ${value}`);
        this.page.on("domcontentloaded", page => {
            page.evaluate(({ flag, value, LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP }) => {
                if (!window[LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP]) {
                    window[LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP] = {};
                }
                window[LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP][flag] = value;
                console.log(`window.${LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP}`);
                console.log(window[LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP]);
            }, {
                flag,
                value,
                LAUNCH_DARKLY_OVERRIDDEN_FLAGS_WINDOW_PROP,
            });
        });
    }
    /* eslint-enable no-console */
}

const createAccountFixtures = async (testInfo?: TestInfo) => {
    const config = BindersConfig.get();
    let accountNamePrefix: string;
    if (testInfo) {
        accountNamePrefix = `E2E_${basename(testInfo.file)}_${testInfo.title}_${testInfo.project.name}`;
    } else {
        accountNamePrefix = `E2E_${UUID.random().toString()}`;
    }
    await deleteTestAccounts(accountNamePrefix);
    const accountFactory = new TestAccountFactory(config);
    const account = await accountFactory.getPrefixedFreshAccount(accountNamePrefix);
    return new TestAccountFixtures(config, account.id);
}

type SeedFuncResult = {
    fixtures: TestAccountFixtures;
    itemTree?: {
        root: DocumentCollection,
        items: (DocumentCollection | Binder)[]
    },
    users?: User[];
}

type UserParams = CreateUserParams & { isAdmin?: boolean; isRoot?: boolean; };

type SeedFunc = (options: {
    features?: IFeature[];
    items?: ItemTree;
    users?: UserParams[];
}) => Promise<SeedFuncResult>;

type CreateUniqueLoginFunc = () => string;

const test = playwrightTest.extend<PwTestFixtures>({
    headless: !!process.env.RUNS_IN_PIPELINE,
    serviceLocations: loadConfigJSON<ServiceLocations>("serviceLocations"),
    // eslint-disable-next-line no-empty-pattern
    testInfo: async ({ }, use) => {
        await use({ value: null });
    },
    fixtures: async ({ testInfo }, use) => {
        const fixtures = await createAccountFixtures(testInfo.value);
        await use(fixtures);
    },
    createWindow: async ({ browser, serviceLocations, fixtures }, use) => {
        const createWindow = async () => {
            const page = await browser.newPage();
            return new BrowserWindow(page, serviceLocations, fixtures.getDomain());
        }
        await use(createWindow);
    },
    createTabs: async ({ browser, serviceLocations, fixtures }, use) => {
        const createTabs = async (tabs: number) => {
            const context = await browser.newContext();
            const pages = [];
            for (let i = 0; i < tabs; i++) {
                const page = await context.newPage();
                pages.push(page);
            }
            return pages.map(page => new BrowserWindow(page, serviceLocations, fixtures.getDomain()));
        }
        await use(createTabs);
    },
    seed: async ({ fixtures }, use) => {
        const seedFunc = async (
            options: {
                features?: IFeature[];
                items?: ItemTree;
                users?: UserParams[];
            }
        ) => {
            const result: SeedFuncResult = {
                fixtures,
            };

            if (options.features) {
                await fixtures.enableFeatures(options.features);
            }
            if (options.users) {
                const users = [];
                for (const userParams of options.users) {
                    if (userParams.isAdmin && userParams.isRoot) {
                        throw new Error(`Could not create user ${JSON.stringify(userParams)} as both isAdmin and isRoot are set to true in the seed function parameters.`)
                    }
                    if (userParams.isAdmin) {
                        const user = await fixtures.users.createAdmin(userParams);
                        users.push(user);
                    } else if (userParams.isRoot) {
                        const user = await fixtures.users.createRoot(userParams);
                        users.push(user);
                    } else {
                        const user = await fixtures.users.create(userParams);
                        users.push(user);
                    }
                }
                result.users = users;
            }
            if (options.items) {
                result.itemTree = await fixtures.items.createItemTree(options.items);
            }
            return result;
        }
        await use(seedFunc);
    },
    // eslint-disable-next-line no-empty-pattern
    createUniqueLogin: ({ }, use) => {
        use(() => createUniqueTestLogin());
    }
});

test.beforeEach(async ({ testInfo }, currentTestInfo) => {
    const project = currentTestInfo?.project?.name;
    // eslint-disable-next-line no-console
    console.log(`${bold("===>")} Running test '${bold(currentTestInfo.title)} [${bold(project)}]'`);
    testInfo.value = currentTestInfo;
});

export const pwTest = test;

export type PwTestFixtures = {
    serviceLocations: ServiceLocations;
    testInfo: { value: TestInfo };
    fixtures: TestAccountFixtures;
    createWindow: CreateWindow;
    createTabs: (tabs: number) => Promise<BrowserWindow[]>;
    seed: SeedFunc;
    createUniqueLogin: CreateUniqueLoginFunc;
}

export async function it(label: string, test: () => Promise<void>) {
    process.stdout.write(`${bold("  ::::")} it ${bold(label)}`);
    try {
        await test();
        process.stdout.write(`  ${box("green", "OK")}`);
    } catch (e) {
        process.stdout.write(`  ${box("red", "FAIL")}`);
        throw e
    } finally {
        process.stdout.write("\n");
    }
}
