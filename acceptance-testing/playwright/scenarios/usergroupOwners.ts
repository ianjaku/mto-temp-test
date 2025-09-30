import { LinkUserResult } from "../sections/shared/userlinker/userlinker";
import { TestCase } from "../fixtures";
import { expect } from "@playwright/test";

export class UsergroupOwners extends TestCase {

    async run(): Promise<void> {

        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.leftNavigation.clickUsers();
        await editor.usersettings.openTab("Group owners");

        const groups = this.testData.seedData.groups;
        const readers = this.testData.seedData.users.filter(u => u.login.includes("reader"));
        const editors = this.testData.seedData.users.filter(u => u.login.includes("editor"));
        const admin = this.testData.seedData.users.find(u => u.login.includes("seleniumdroid"));

        const readerAddResult = await editor.usersettings.usergroupOwners.addGroupOwner(groups[0].name, readers[0]);
        await expect(readerAddResult).toBe(LinkUserResult.NotFound);
        const editorAddResult = await editor.usersettings.usergroupOwners.addGroupOwner(groups[0].name, editors[0]);
        await expect(editorAddResult).toBe(LinkUserResult.Success);

        await editor.usersettings.usergroupOwners.addGroupOwner(groups[0].name, editors[1]);
        await editor.usersettings.usergroupOwners.addGroupOwner(groups[0].name, admin, 1);
        await editor.usersettings.usergroupOwners.deleteGroupOwner(groups[0].name, admin);
        await editor.usersettings.usergroupOwners.deleteGroupOwner(groups[0].name, editors[1]);
    }
}
