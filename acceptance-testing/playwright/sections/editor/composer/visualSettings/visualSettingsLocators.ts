import { TestSectionLocators } from "../../testsectionlocators";

export class VisualSettingsLocators extends TestSectionLocators {
    backgroundColorPickerButton = this.page.locator(".visual-bgcolor-setting-colorpicker-swatch");
    backgroundColorPickerModalInput = this.page.locator(".rc-color-picker-panel-params-hex");
    transformToggle = this.page.getByTestId("visual-settings-transform-toggle");
    closeModalButton = this.page.locator(".visual-edit-modal .modal-closeBtn");
}
