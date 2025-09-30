import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";

pwTest("Device user login", async ({ createWindow, createTabs, seed, fixtures }, testInfo) => {
    if (testInfo.project.name === "firefox") {
        // Try re-enabling after playwright upgrade
        return;
    }

    const users = [{
        displayName: "Device Target User",
        firstName: "Device Target",
        lastName: "User",
        login: createUniqueTestLogin(),
        password: "i_is_device_target1"
    }];
    const adHocDeviceUser = createUniqueTestLogin().substring(0, 20);
    const deviceTargetUsers = [ users[0] ];

    await seed({
        features: [ "public_content", "device_user_impersonation" ],
        users
    });

    const deviceUserPassword = "i_is_device";
    const deviceUser = await fixtures.users.createAdmin({
        displayName: "Device User",
        firstName: "Device",
        lastName: "User",
        login: createUniqueTestLogin(),
        password: deviceUserPassword
    })

    await fixtures.items.createDocument(
        {
            title: "A public advertised doc",
            languageCode: "en",
            languageChunks: {
                "en": [ "This is chunk 1" ]
            }
        },
        {
            publish: true,
            public: true,
            addToRoot: true
        }
    );

    await fixtures.items.createDocument(
        {
            title: "A doc",
            languageCode: "en",
            languageChunks: {
                "en": [ "This is chunk 1" ]
            }
        },
        {
            publish: true,
            public: true,
            addToRoot: true
        }
    );

    const secondTargetUser = await fixtures.users.create({
        displayName: "Device Target 2 User",
        firstName: "Device Target 2",
        lastName: "User",
        login: createUniqueTestLogin(),
        password: "i_is_device_target2"
    });

    const thirdTargetUser = await fixtures.users.create({
        displayName: "Device Target 3 User",
        firstName: "Device Target 3",
        lastName: "User",
        login: createUniqueTestLogin(),
        password: "i_is_device_target3"
    });
    const thirdTargetUserId = thirdTargetUser.id;
    const thirdTargetUserName = thirdTargetUser.displayName;
    const firstTargetUserLogin = deviceTargetUsers[0].login.substring(0, 20);
    const firstTargetUserName = deviceTargetUsers[0].displayName;
    const secondTargetUserId = secondTargetUser.id;
    const secondTargetUserName = secondTargetUser.displayName;
    const group = await fixtures.groups.create("Device Users");
    const group2 = await fixtures.groups.create("Location Users");
    await fixtures.groups.addUserToGroup(group.id, secondTargetUserId);
    await fixtures.groups.addUserToGroup(group.id, thirdTargetUserId);
    await fixtures.groups.addUserToGroup(group2.id, thirdTargetUserId);

    const editorWindow = await createWindow();

    const editor = await editorWindow.openEditor();
    await editor.login.loginWithEmailAndPass(deviceUser.login, deviceUserPassword);
    await editor.cookieBanner.acceptCookies();

    await editor.leftNavigation.clickUsers();
    await editor.usersettings.openSettings(deviceUser.login);
    await editor.usersettings.openTab("Device");
    await editor.usersettings.clickSettingsCheckbox("This user represents a device");
    await editor.usersettings.stageDeviceUser(firstTargetUserLogin, true);
    await editor.usersettings.stageDeviceUser(adHocDeviceUser, false);
    await editor.usersettings.stageDeviceUsergroup(group.name);
    await editor.usersettings.addStagedDeviceUsers(true);
    await editor.usersettings.closeSettings();
    await editor.usersettings.userRowExists(firstTargetUserLogin);
    await editor.usersettings.userRowExists(adHocDeviceUser);

    const [ readerTab1, readerTab2 ] = await createTabs(2);
    const reader = await readerTab1.openReader();
    await reader.login.loginWithEmailAndPass(deviceUser.login, deviceUserPassword);
    await reader.breadcrumbs.expectBreadcrumbs(["My Library"]);
    await reader.modals.deviceUserSwitcher.expectTarget(firstTargetUserName);
    await reader.modals.deviceUserSwitcher.expectTarget(secondTargetUserName);
    await reader.modals.deviceUserSwitcher.expectTarget(adHocDeviceUser);
    await reader.modals.deviceUserSwitcher.selectDeviceTargetUser(adHocDeviceUser);
    const title1 = "A public advertised doc";
    const title2 = "A doc";
    await reader.browser.expectStoryByTitle(title1);
    await reader.browser.expectStoryByTitle(title2);
    await reader.browser.expectLoggedInUser(adHocDeviceUser);
    await reader.topBar.logOut();
    await reader.breadcrumbs.expectBreadcrumbs(["My Library"]);
    await reader.modals.deviceUserSwitcher.selectDeviceTargetUser(firstTargetUserName);
    await reader.browser.expectStoryByTitle(title1);
    await reader.browser.expectStoryByTitle(title2);
    await reader.browser.expectLoggedInUser(firstTargetUserName);
    await reader.topBar.logOut();

    await editor.usersettings.openSettings(deviceUser.login);
    await editor.usersettings.openTab("Device");
    await editor.usersettings.removeDeviceTarget(firstTargetUserName);
    await editor.usersettings.removeDeviceTarget(adHocDeviceUser);
    await editor.usersettings.removeDeviceTarget(group.name);
    await editor.usersettings.stageDeviceUsergroupIntersection([group.name, group2.name]);
    await editor.usersettings.addStagedDeviceUsers();
    await editor.usersettings.closeSettings();

    const reader2 = await readerTab2.openReader();
    await reader2.breadcrumbs.expectBreadcrumbs(["My Library"]);
    await reader2.modals.deviceUserSwitcher.expectTarget(thirdTargetUserName);
    await reader2.modals.deviceUserSwitcher.selectDeviceTargetUser(thirdTargetUserName);
    await reader2.modals.deviceUserSwitcher.expectTargetAbsent(firstTargetUserName);
    await reader2.modals.deviceUserSwitcher.expectTargetAbsent(secondTargetUserName);
    await reader2.modals.deviceUserSwitcher.expectTargetAbsent(adHocDeviceUser);
    await reader2.browser.expectStoryByTitle(title1);
    await reader2.browser.expectStoryByTitle(title2);
    await reader2.browser.expectLoggedInUser(thirdTargetUserName);
});