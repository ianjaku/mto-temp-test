import { TestCase } from "../fixtures";

export class Access extends TestCase {

    private rootCollection = this.testData.seedData.rootCollection;
    private testCollection = this.testData.seedData.itemHierarchy.children[0].name;
    private readerCollection = this.testData.seedData.itemHierarchy.children[0].children[3].name;
    private testUser = this.testData.credentials.noAdminUsers[0];

    async run(): Promise<void> {
        const editorWindow = await this.createBrowserWindow();
        const editor = await editorWindow.openEditorAndLogin();
        await editor.routing.toUserSettings();
        await editor.usersettings.openTab("User groups");

        const groupName = `TEST GROUP-${Math.random().toString(36).substr(2, 9)}`;
        await editor.usersettings.usergroups.createUsergroup(groupName);
        await editor.usersettings.usergroups.expandUsergroup(groupName);
        await editor.usersettings.usergroups.addUserToGroup(this.testUser.name);

        await editor.leftNavigation.clickMyLibrary();
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Access");

        await editor.accessModal.deleteUserAccess(this.testUser.name);
        await editor.accessModal.clickDone();

        await editor.browse.clickItemContextMenu(this.testCollection);
        await editor.browse.clickItemInContextMenu("Access");

        await editor.accessModal.addUserAccess(groupName, "Reader", { isGroup: true });
        await editor.accessModal.clickDone();

        const readerWindow = await this.createBrowserWindow();
        const reader = await readerWindow.openReader({
            credentials: { login: this.testUser.login, password: this.testUser.password },
            queryParams: { domain: this.testData.seedData.domain }
        });
        await reader.browser.expectStoryByTitle(this.readerCollection);

        await editor.routing.toUserSettings();
        await editor.usersettings.openTab("User groups");
        await editor.usersettings.usergroups.expandUsergroup(groupName);
        await editor.usersettings.usergroups.deleteUserFromGroup(this.testUser.name);
        await editor.usersettings.usergroups.deleteUsergroup(groupName);

        await editor.leftNavigation.clickMyLibrary();
        await editor.breadcrumbs.openContextMenu();
        await editor.breadcrumbs.clickItemContextMenu("Access");
        await editor.accessModal.addUserAccess(this.testUser.name, "Reader");
        await editor.accessModal.clickDone();

    }

}
