import { TestCase } from "../fixtures";

export class ErrorReasons extends TestCase {
    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const reader = await window.openReader();
        await reader.errors.expectEmptyAccount();

        const editor = await window.openEditorAndLogin();

        const userId = this.testData.seedData.users?.[0].id;
        await this.testData.clients.credentials.endSessionsForUser({ userId });

        window.reload()
        await editor.login.expectErrorMessage("Your session has expired. Please log back in.");
    }
}

export class InvalidEditorLoginErrorReason extends TestCase {
    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const editor = await window.openEditorLogin();
        await editor.login.loginWithEmailAndPass("foo", "bar");
        await editor.login.expectErrorMessage("Username or password is not correct.");
    }
}

export class InvalidReaderLoginErrorReason extends TestCase {
    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const reader = await window.openReaderLogin();
        await reader.login.loginWithEmailAndPass("foo", "bar");
        await reader.login.expectErrorMessage("Username or password is not correct.");
    }
}

export class NoErrorOnFirstVisitToLogin extends TestCase {
    async run(): Promise<void> {
        const window = await this.createBrowserWindow();
        const editor = await window.openEditorLogin();
        await editor.login.expectNoErrorMessage();

    }
}

