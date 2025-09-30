import { AccessModalLocators } from "./accessmodalLocators";
import { TestSection } from "../../testsection";
import { UserLinker } from "../../shared/userlinker/userlinker";
import { expect } from "@playwright/test";

export class AccessModal extends TestSection {

    private readonly locators = new AccessModalLocators(this.context);

    async addUserAccess(name: string, roleName: string, options?: { isGroup?: boolean, translatorLanguage?: string }): Promise<void> {
        await this.userLinkerAddAccess.stageUserOrGroup(name, options, "#absolutePositioningTarget ");
        await this.locators.roleSelect.click();
        await this.locators.getRoleInSelect(roleName).click();
        if (roleName === "Translator") {
            if (!options?.translatorLanguage) {
                throw new Error("Cannot set the translator role without a language, please configure translatorLanguage");
            }
            await this.locators.languagesDropdown.click();
            await this.locators.getSelectionForLanguage(options.translatorLanguage).scrollIntoViewIfNeeded();
            await this.locators.getSelectionForLanguage(options.translatorLanguage).click();
        }
        await this.locators.addUserBtn.click();
    }

    async clickDone(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Done").click();
        await this.sharedLocators.getButtonInModal("Done").waitFor({ state: "hidden" });
    }

    async deleteUserAccess(username: string): Promise<void> {
        await this.locators.getDeleteButtonForUser(username).click();
        await this.locators.getUserRow(username).waitFor({ state: "detached" });
    }

    async toggleIsPublic(): Promise<void> {
        await this.locators.isPublicCheckbox.click();
    }

    async assertIsPublicCheckedAndDisabled(): Promise<void> {
        const isChecked = await this.locators.isPublicCheckbox.isChecked();
        expect(isChecked).toBe(true);
        const isDisabled = await this.locators.isPublicCheckbox.isDisabled();
        expect(isDisabled).toBe(true);
    }

    async toggleShowOnLandingPage(): Promise<void> {
        await this.locators.showOnLandingPageCheckbox.click();
    }

    get userLinkerAddAccess(): UserLinker {
        return new UserLinker(this.context);
    }
}
