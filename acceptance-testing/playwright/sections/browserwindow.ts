import { Browser, Cookie, Page, expect } from "@playwright/test";
import { EditorSections } from "./editor/editorsections";
import { ReaderSections } from "./reader/readersections";
import { TestContext } from "./testcontext";
import { TestData } from "../../config/boilerplate/contract";


export interface ReaderOptions {
    path?: string;
    queryParams?: Record<string, string>;
    credentials?: { login: string, password: string}
}

export class BrowserWindow {

    constructor(
        private readonly page: Page,
        private readonly testData: TestData
    ) {}

    private createContext(): TestContext {
        return {
            page: this.page,
            editorUrl: this.testData.locations.editor,
            readerUrl: this.testData.locations.reader
        }
    }

    async getCookies(): Promise<Cookie[]> {
        return this.page.context().cookies();
    }

    async openEditorAndLogin(): Promise<EditorSections> {
        const editorSections = await this.openEditorLogin();
        await editorSections.login.loginWithEmailAndPass(
            this.testData.credentials.login,
            this.testData.credentials.password
        );
        await editorSections.cookieBanner.acceptCookies();
        return editorSections;
    }

    async openEditorLogin(): Promise<EditorSections> {
        await this.page.goto(this.testData.locations.editor + "/login");
        const editorSections = new EditorSections(this.createContext());
        return editorSections;
    }

    async openReaderLogin(): Promise<ReaderSections> {
        await this.page.goto(this.testData.locations.reader + "/login?domain=" + this.testData.seedData.domain);
        const readerSections = new ReaderSections(this.createContext());
        return readerSections;
    }

    async openReader(options: Partial<ReaderOptions> = {}): Promise<ReaderSections> {
        let { credentials } = options;
        const { path } = options;

        if (!credentials) {
            credentials = this.testData.credentials;
        }
        const readerSections = await this.openReaderLogin();
        await readerSections.login.loginWithEmailAndPass(
            credentials.login,
            credentials.password
        );
        if (path) {
            const url = new URL(this.testData.locations.reader + path);
            url.searchParams.set("domain", this.testData.seedData.domain);
            for (const [key, value] of Object.entries(options.queryParams || {})) {
                url.searchParams.set(key, value);
            }
            // eslint-disable-next-line no-console
            console.log(`Navigating to ${url.toString()}`);
            await this.page.goto(url.toString());
        }
        return readerSections;
    }

    async openReaderIncognito(): Promise<ReaderSections> {
        await this.page.goto(this.testData.locations.reader + "/?domain=" + this.testData.seedData.domain);
        const readerSections = new ReaderSections(this.createContext());
        return readerSections;
    }

    async toReaderRoot(): Promise<void> {
        await this.page.goto(this.testData.locations.reader + "?domain=" + this.testData.seedData.domain);
    }

    async expectUrl(regex: RegExp): Promise<void> {
        await expect(this.page).toHaveURL(regex);
    }

    async reload(): Promise<void> {
        await this.page.reload();
    }

    getPage(): Page {
        return this.page;
    }

    public static async create(
        browser: Browser,
        testData: TestData
    ): Promise<BrowserWindow> {
        const page = await browser.newPage();
        page.setDefaultTimeout(120000);
        return new BrowserWindow(page, testData);
    }

}
