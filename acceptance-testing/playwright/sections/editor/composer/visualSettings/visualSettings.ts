import { TestSection } from "../../../testsection";
import { VisualSettingsLocators } from "./visualSettingsLocators";

export class VisualSettings extends TestSection {

    private locators = new VisualSettingsLocators(this.context);

    async setBackgroundColor(color: string): Promise<void> {
        await this.locators.backgroundColorPickerButton.click();
        await this.locators.backgroundColorPickerModalInput.fill(color);
        await this.locators.backgroundColorPickerModalInput.press("Enter");
    }

    async setMediaBehaviourToTransformed(): Promise<void> {
        await this.locators.transformToggle.click();
    }

    async close(): Promise<void> {
        await this.locators.closeModalButton.click();
    }

}
