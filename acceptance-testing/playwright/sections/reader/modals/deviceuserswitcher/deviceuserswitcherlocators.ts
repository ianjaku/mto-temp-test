import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../../editor/testsectionlocators";

export class DeviceUserSwitcherLocators extends TestSectionLocators {

    deviceUserSwitcher = this.page.locator(".deviceLoginModal");

    getDeviceTargetButton(login: string): Locator {
        return this.page.locator(`.deviceLoginModal .targetItem >> text=${login}`);
    }
    
}
