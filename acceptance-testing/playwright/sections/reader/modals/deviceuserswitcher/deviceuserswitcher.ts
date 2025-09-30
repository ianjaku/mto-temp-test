import { DeviceUserSwitcherLocators } from "./deviceuserswitcherlocators";
import { TestSection } from "../../../testsection";
import { expect } from "@playwright/test";


export class DeviceUserSwitcher extends TestSection {

    private readonly locators = new DeviceUserSwitcherLocators(this.context);

    async selectDeviceTargetUser(displayName: string): Promise<void> {
        await this.locators.getDeviceTargetButton(displayName).click();
        await this.locators.deviceUserSwitcher.waitFor({ state: "hidden" });
    }

    async expectTarget(displayName: string): Promise<void> {
        await expect(this.locators.getDeviceTargetButton(displayName)).toBeVisible();
    }

    async expectTargetAbsent(displayName: string): Promise<void> {
        await expect(this.locators.getDeviceTargetButton(displayName)).toBeHidden();
    }

}
