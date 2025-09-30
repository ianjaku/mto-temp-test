import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class UserSettingsLocators extends TestSectionLocators {

    linkedUsersTextarea = this.page.locator("textarea[class='autocomplete-textarea']");
    userLinkerListHeader = this.page.locator(".userLinkerListHeader");
    closeSettingsButon = this.page.locator(".button >> text=Close");
    userInputTypeSwitcherDropdown = this.page.locator(".userInputTypeSwitcher .dropdown-field");

    public getDeviceTargetUnlinkButton(displayName: string) {
        return this.getDeviceTargetCard(displayName)
            .locator("span >> text=delete");
    }

    public getSettingsButtonForUser(login: string): Locator {
        return this.getRowForUser(login).locator("text=settings");
    }

    public getTab(name: string): Locator {
        return this.page.locator(`.tabs-nav-list >> .tabs-title >> text=${name}`);
    }

    public getSettingsCheckbox(label: string): Locator {
        return this.page
            .locator(".deviceUserSettings-section", { hasText: label })
            .locator("input[type='checkbox']");
    }

    public getDeviceUsersAddBtn(): Locator {
        return this.page.locator(".deviceUserSettings >> .button >> text=Add");
    }

    public getRowForUser(login: string): Locator {
        return this.page.locator(".manage-users-overview tr", { hasText: login });
    }

    public getChip(text: string): Locator {
        return this.page.locator(`.MuiChip-label >> text=${text}`);
    }

    public getDeviceTargetCard(displayName: string): Locator {
        return this.page.locator(".userLinkerListCards-card")
            .filter({
                has: this.page.locator(`.userLinkerListCards-card-primLbl >> text=${displayName}`)
            });
    }

    public getUserInputTypeDDField(text: string): Locator {
        return this.page.locator(`.dropdown-field-label-group-text >> text=${text}`);
    }


}
