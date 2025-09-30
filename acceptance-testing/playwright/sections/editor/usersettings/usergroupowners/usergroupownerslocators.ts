import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../testsectionlocators";

export class UserGroupOwnersLocators extends TestSectionLocators {


    public getAddGroupOwnerClickable(groupname: string): Locator {
        return this.page
            .locator(".groupOwners-tiles .groupOwnerTile", { has: this.page.locator(`.groupOwnerTile-name >> text=${groupname}`) })
            .locator(".groupOwnerTile-add");
    }

    public getOwnersLabel(groupname: string): Locator {
        return this.page
            .locator(".groupOwners-tiles .groupOwnerTile", { has: this.page.locator(`.groupOwnerTile-name >> text=${groupname}`) })
            .locator(".groupOwnerTile-ownersLabel");
    }

    public getOwnerLabel(groupname: string, username: string): Locator {
        return this.page
            .locator(".groupOwners-tiles .groupOwnerTile", { has: this.page.locator(`.groupOwnerTile-name >> text=${groupname}`) })
            .locator(`.groupOwnerTile-ownersLabel-owner >> text=${username}`);
    }

    public getOwnerSurplusLabel(groupname: string, surplus: number): Locator {
        return this.page
            .locator(".groupOwners-tiles .groupOwnerTile", { has: this.page.locator(`.groupOwnerTile-name >> text=${groupname}`) })
            .locator(`.groupOwnerTile-ownersLabel-owner >> text=+${surplus}`);
    }
}