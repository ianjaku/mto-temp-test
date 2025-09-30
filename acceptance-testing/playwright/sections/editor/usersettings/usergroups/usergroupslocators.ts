import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../testsectionlocators";

export class UserGroupsLocators extends TestSectionLocators {

    newUserGroupBtn = this.page.locator(".button >> text=New user group");
    newUserGroupInput = this.page.locator("[placeholder=\"Usergroup name\"]");
    addManyBtn = this.page.locator(".button >> text=Add many");
    chooseBtnInAddManyModal = this.page.locator(".modal .button >> text=Choose");
    nonMembersColumnDropTarget = this.page.locator(".organizable-lists-body-column:nth-child(2)");

    accordionHeaderWithGroupname(groupName: string): Locator {
        return this.page.locator(`.accordion-header >> text="${groupName}"`);
    }

    organizableListsInUsergroupAccordion(groupName: string): Locator {
        return this.page.locator(".accordion", { has: this.page.locator(`.accordion-header >> text="${groupName}"`) })
            .locator(".accordion-body .organizable-lists");
    }

    checkboxForUserInAddManyModal(username: string): Locator {
        return this.page.locator(".modal .table tr", { hasText: username })
            .locator("input[type='checkbox']");
    }

    getDraggableUserRowInList(columnZeroBased: number, username: string): Locator {
        return this.page.locator(`.organizable-lists-body-column:nth-child(${columnZeroBased + 1}) >> text="${username}"`);
    }

    getUserRowInMembersColumn(username: string): Locator {
        return this.page.locator(`.organizable-lists-body-column:nth-child(1) >> text="${username}"`);
    }

    getUserRowInNonMembersColumn(username: string): Locator {
        return this.page.locator(`.organizable-lists-body-column:nth-child(2) >> text="${username}"`);
    }

    getDeleteUserGroupBtn(groupName: string): Locator {
        return this.page.locator(".accordion-header", { hasText: groupName })
            .locator("text=delete");
    }
}
