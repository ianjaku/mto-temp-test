import { TestCase } from "../fixtures";
import { expect } from "@playwright/test";

const COOKIE_NAME = "manual-login";


export class EnsureSecureCookies extends TestCase {

    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        await editorWindow.openEditorAndLogin();

        const cookies = await editorWindow.getCookies();
        const loginCookie = cookies.find(c => c.name === COOKIE_NAME);

        await expect(loginCookie == null).toBeFalsy();

        await expect(loginCookie.httpOnly).toBeTruthy();

        if (!this.isLocalDomain(loginCookie.domain)) {
            await expect(loginCookie.secure).toBeTruthy();
        }
    }

    private isLocalDomain(domain: string): boolean {
        const normalizedDomain = domain.trim().toLowerCase();
        if (normalizedDomain.includes("dockerhost")) return true;
        if (normalizedDomain.includes("localhost")) return true;
        if (normalizedDomain.includes("127.0.0.1")) return true;
        return false;
    }
}
