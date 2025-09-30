import { TestSection } from "../../../testsection";
import { UserGroupsLocators } from "./usergroupslocators";

export class UserGroups extends TestSection {

    private readonly locators = new UserGroupsLocators(this.context);

    async createUsergroup(
        groupName: string,
    ): Promise<void> {
        await this.locators.newUserGroupBtn.click();
        await this.locators.newUserGroupInput.fill(groupName);
        await this.sharedLocators.getButtonInModal("Save").click();
        await this.locators.accordionHeaderWithGroupname(groupName).waitFor();
    }

    async deleteUsergroup(
        groupName: string,
    ): Promise<void> {
        await this.locators.getDeleteUserGroupBtn(groupName).click();
        await this.sharedLocators.getButtonInModal("OK").click();
        await this.locators.accordionHeaderWithGroupname(groupName).waitFor({ state: "detached" });
    }

    async expandUsergroup(
        groupName: string,
    ): Promise<void> {
        await this.locators.accordionHeaderWithGroupname(groupName).click();
        await this.locators.organizableListsInUsergroupAccordion(groupName).waitFor();
    }

    async addUserToGroup(name: string): Promise<void> {
        await this.locators.addManyBtn.click();
        await this.locators.checkboxForUserInAddManyModal(name).click();
        await this.locators.chooseBtnInAddManyModal.click();
        await this.locators.getUserRowInMembersColumn(name).waitFor();
    }

    async deleteUserFromGroup(name: string): Promise<void> {
        await this.locators.getDraggableUserRowInList(0, name).click();
        await this.locators.getDraggableUserRowInList(0, name).hover();
        await this.page.mouse.down();
        await this.locators.nonMembersColumnDropTarget.hover();
        await this.page.mouse.up();
        await this.locators.getUserRowInNonMembersColumn(name).waitFor();

    }


}
