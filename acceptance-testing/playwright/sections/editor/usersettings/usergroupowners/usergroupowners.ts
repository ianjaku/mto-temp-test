import { LinkUserResult, UserLinker } from "../../../shared/userlinker/userlinker";
import { TestSection } from "../../../testsection";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserGroupOwnersLocators } from "./usergroupownerslocators";
import { expect } from "@playwright/test";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";

export class UserGroupOwners extends TestSection {

    private readonly locators = new UserGroupOwnersLocators(this.context);

    async addGroupOwner(
        groupName: string,
        user: User,
        expectedSurplusLabel?: number,
    ): Promise<LinkUserResult> {
        await this.locators.getAddGroupOwnerClickable(groupName).click();
        const result = await this.userLinkerOwners.linkUserOrGroup(user.login, { ignoreInputType: true });
        if (result === LinkUserResult.Success) {
            if (expectedSurplusLabel) {
                await this.locators.getOwnerSurplusLabel(groupName, expectedSurplusLabel).waitFor();
            } else {
                await this.locators.getOwnerLabel(groupName, getUserName(user)).waitFor();
            }
        }
        return result;
    }

    async deleteGroupOwner(
        groupName: string,
        user: User,
    ): Promise<void> {
        const username = getUserName(user);
        await this.locators.getAddGroupOwnerClickable(groupName).click();
        await this.userLinkerOwners.unlinkUser(username);
        const ownerLabelText = await this.locators.getOwnersLabel(groupName).innerText();
        expect(ownerLabelText).not.toContain(username);
    }

    get userLinkerOwners(): UserLinker {
        return new UserLinker(this.context);
    }
}
