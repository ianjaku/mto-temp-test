import { TestSection } from "../../testsection";
import { UserLinkerLocators } from "./userlinkerlocators";

export enum LinkUserResult {
    NotFound,
    Success,
}

export class UserLinker extends TestSection {

    private readonly locators = new UserLinkerLocators(this.context);

    async linkUserOrGroup(
        name: string,
        options?: { isGroup?: boolean, ignoreInputType?: boolean },
    ): Promise<LinkUserResult> {
        const stageResult = await this.stageUserOrGroup(name, options);
        if (stageResult === LinkUserResult.NotFound) {
            return LinkUserResult.NotFound;
        }
        await this.addUserOrGroup();
        return LinkUserResult.Success;
    }

    async stageUserOrGroup(
        name: string,
        options?: { isGroup?: boolean, ignoreInputType?: boolean },
        userInputSelectorPrefix = ""
    ): Promise<LinkUserResult | void> {
        const isGroup = options?.isGroup ?? false;
        const ignoreInputType = options?.ignoreInputType ?? false;
        if (!ignoreInputType) {
            await this.locators.userInputTypeSwitcher.click();
            await this.locators.getUserOrGroupMenuitem(isGroup ? "Usergroup" : "User", userInputSelectorPrefix).click();
        }
        await this.locators.userInputText.selectText();
        await this.locators.userInputText.press("Backspace");
        await this.locators.userInputText.fill(name);
        await this.locators.userInputAutocompleteCompletedLoading.waitFor({ state: "visible" });
        const isVisible = await this.sharedLocators.getAutocompleteItem(name).isVisible();
        if (!isVisible) {
            return LinkUserResult.NotFound;
        }
        await this.sharedLocators.getAutocompleteItem(name).click();
        await this.locators.getChip(name).waitFor();
    }

    async addUserOrGroup(): Promise<void> {
        await this.locators.userLinkerAddBtn.click();
    }

    async unlinkUser(
        username: string,
    ): Promise<void> {
        await this.locators.getUserRowDeleteBtn(username).click();
        await this.locators.getUserRow(username).waitFor({ state: "detached" })
    }


}



