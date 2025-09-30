import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class UserLinkerLocators extends TestSectionLocators {
    userInputTypeSwitcher = this.page.locator(".userInputTypeSwitcher")
    userInputText = this.page.locator(".userInput .autocomplete textarea")
    userInputProgress = this.page.locator(".userInput .autocomplete autocomplete-alignEnd .MuiCircularProgress-root")
    userInputAutocompleteCompletedLoading = this.page.locator(".userInput .autocomplete--loadingComplete")
    userLinkerAddBtn = this.page.locator(".userLinkerAdd-userInput-btns-add")

    public getChip(name: string): Locator {
        return this.page.locator(`.autocomplete-pane-chips .autocomplete-chip >> text=${name}`);
    }

    public getUserRow(username: string): Locator {
        return this.page
            .locator(".userLinkerListRows-row", { has: this.page.locator(`label >> text=${username}`) })
    }

    public getUserRowDeleteBtn(username: string): Locator {
        return this.getUserRow(username).locator(".userLinkerListRows-row-tail-unlinkBtn")
    }

    public getUserOrGroupMenuitem(name: "User" | "Usergroup", selectorPrefix = ""): Locator {
        return this.page.locator(`${selectorPrefix}.dropdown-field-label .dropdown-field-label-group-text`, { hasText: new RegExp(`^${name}$`) });
    }

}
