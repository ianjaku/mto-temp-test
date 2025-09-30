import { TestSectionLocators } from "../../editor/testsectionlocators";

export class HubspotWidgetLocators extends TestSectionLocators {
    closeButton = this.page.frameLocator("#hubspot-conversations-iframe")
        .locator("[data-test-id='initial-message-close-button']");
    widget = this.page.frameLocator("#hubspot-conversations-iframe")
        .locator(".hubspot .widget");
}
