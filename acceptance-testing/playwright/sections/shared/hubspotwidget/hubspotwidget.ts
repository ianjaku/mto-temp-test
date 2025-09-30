import { HubspotWidgetLocators } from "./hubspotwidgetlocators";
import { TestSection } from "../../testsection";

export class HubspotWidget extends TestSection {

    private readonly locators = new HubspotWidgetLocators(this.context);

    async maybeClose(): Promise<void> {
        try {
            await this.locators.closeButton.click();
            await this.locators.widget.waitFor({ state: "hidden" });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Hubspot widget close button not found within the timeout, continuing...");
        }
    }
}
