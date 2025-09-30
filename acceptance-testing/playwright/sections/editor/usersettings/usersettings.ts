import { TestSection } from "../../testsection";
import { UserGroupOwners } from "./usergroupowners/usergroupowners";
import { UserGroups } from "./usergroups/usergroups";
import { UserSettingsLocators } from "./usersettingslocators";

export class UserSettings extends TestSection {

    private readonly locators = new UserSettingsLocators(this.context);

    async openSettings(login: string): Promise<void> {
        await this.locators.getSettingsButtonForUser(login).click();
    }

    async closeSettings(): Promise<void> {
        await this.locators.closeSettingsButon.click();
    }

    async openTab(name: string): Promise<void> {
        await this.locators.getTab(name).click();
    }

    async clickSettingsCheckbox(label: string): Promise<void> {
        await this.locators.getSettingsCheckbox(label).click();
        /**
         * If we immediately start typing in the autocomplete box,
         * then for some reason, the "New linked user" modal opens
         * seemingly without reason.
         *
         * Surprisingly the cause is not the onBlur of the autocomplete as
         * the bug still happens without it.
         *
         * Also, for some reason, this bug only happens inside the pipeline.
         * It, also, only happens sometimes.
         */
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async stageDeviceUser(
        login: string,
        userExists = false,
    ): Promise<void> {
        const userInput = this.locators.linkedUsersTextarea;
        await userInput.fill(login);
        if (userExists) {
            await this.sharedLocators.getAutocompleteItem(login).click();
        } else {
            await userInput.press("Enter");
        }
        await this.locators.getChip(login).waitFor();
    }

    async stageDeviceUsergroup(
        groupName: string,
    ): Promise<void> {
        await this.locators.userInputTypeSwitcherDropdown.click();
        await this.locators.getUserInputTypeDDField("Usergroup").click();
        const userInput = this.locators.linkedUsersTextarea;
        await userInput.fill(groupName);
        await this.sharedLocators.getAutocompleteItem(groupName).click();
        await this.locators.getChip(groupName).waitFor();
    }

    async stageDeviceUsergroupIntersection(groupNames: string[]): Promise<void> {
        await this.locators.userInputTypeSwitcherDropdown.click();
        await this.locators.getUserInputTypeDDField("Intersection").click();
        for (const groupName of groupNames) {
            const userInput = this.locators.linkedUsersTextarea;
            await userInput.fill(groupName);
            await this.sharedLocators.getAutocompleteItem(groupName).click();
            await this.locators.getChip(groupName).waitFor();
        }
    }

    async removeDeviceTarget(name: string) {
        const card = this.locators.getDeviceTargetCard(name);
        const deviceTargetUnlinkButton = this.locators.getDeviceTargetUnlinkButton(name);
        for (const _ of [1, 2, 3]) {
            await card.hover();
            const isVisible = await deviceTargetUnlinkButton.isVisible();
            if (!isVisible) {
                await new Promise(resolve => setTimeout(resolve, 200));
                continue;
            }
            await deviceTargetUnlinkButton.click();
            break;
        }
        await card.waitFor({ state: "hidden" });
    }

    async addStagedDeviceUsers(containsNewUsers = false): Promise<void> {
        await this.locators.getDeviceUsersAddBtn().click();
        if (containsNewUsers) {
            await this.sharedLocators.getButtonInModal("Yes").click();
        }
        await this.locators.userLinkerListHeader.waitFor({ state: "visible" });
    }

    async userRowExists(login: string): Promise<boolean> {
        return (await this.locators.getRowForUser(login).count()) > 0;
    }

    get usergroupOwners(): UserGroupOwners {
        return new UserGroupOwners(this.context);
    }

    get usergroups(): UserGroups {
        return new UserGroups(this.context);
    }

}
