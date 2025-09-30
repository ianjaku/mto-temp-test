import { TestSection } from "../../testsection";
import { TestSectionLocators } from "../testsectionlocators";
import { expect } from "@playwright/test";

export class DocumentOwnership extends TestSection {

    private readonly locators = new DocumentOwnershipLocators(this.context);

    async cancel(): Promise<void> {
        await this.locators.cancelButton.click();
    }

    async save(): Promise<void> {
        await this.locators.saveButton.click()
    }

    async expectModalBodyTextToContain(text: string): Promise<void> {
        await expect(this.locators.modalBody).toContainText(text);
    }

    async searchUser(prefix: string) {
        await this.locators.userTextarea.type(prefix)
    }

    async searchGroup(prefix: string) {
        await this.locators.groupTextarea.type(prefix)
    }

    async clickAutocompleteItem(pattern: string) {
        await this.locators.autocompletePromptItem(pattern).click();
    }

    async clickOverride() {
        await this.locators.override.click();
    }

    async switchToGroups() {
        await this.locators.dropdownElementsUser.click();
        await this.locators.dropdownElementsGroup.click();
    }

    async expectRestrictedAccessToParentSettings(): Promise<void> {
        await expect(this.locators.inheritedParentNames.first())
            .toContainText("Restricted access");
    }
}

export class DocumentOwnershipLocators extends TestSectionLocators {
    saveButton = this.page.locator(".button:has-text(\"Save\")")
    cancelButton = this.page.locator(".button:has-text(\"Cancel\")")
    modalBody = this.page.locator(".approval-modal .modal-body");
    userTextarea = this.page.getByPlaceholder("Type to add users");
    groupTextarea = this.page.getByPlaceholder("Type to add groups");
    dropdownElementsUser = this.page.locator(".userInputTypeSwitcher >> text=User");
    dropdownElementsGroup = this.page.locator(".dropdown-field-label-group-text >> text=Usergroup");
    override = this.page.locator("text=\"Specify owners\"");
    inheritedParentNames = this.page.locator(".collectionLink >> label");

    autocompletePromptItem(pattern: string) {
        return this.page.locator(`.autocomplete-prompt-item:has-text("${pattern}")`);
    }
}
