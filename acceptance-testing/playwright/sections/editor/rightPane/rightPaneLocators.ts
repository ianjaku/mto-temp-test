import { TestSectionLocators } from "../testsectionlocators";

export class RightPaneLocators extends TestSectionLocators {

    addANewLanguageButton = this.page.locator("text=Add a new language");
    backgroundColorPickerButton = this.page.locator(".colorpicker-swatch");
    backgroundColorPickerModalInput = this.page.locator(".rc-color-picker-panel-params-hex");
    closeMediaPaneButton = this.page.locator(".drawer-container-header-icon.Media");
    downloadManualRatingsButton = this.page.locator(".rightPane >> .download-ratings-button");
    languageDropdown = this.page.locator(".add-languages-dropdown > input.filterable-dropdown-input");
    languageDropdownFirstElement = this.page.locator(".add-languages-dropdown ul.dropdown-elements > li.dropdown-field-label");
    languageDropDownMarkAs = this.page.locator("span.contextMenu-item-option:has-text('Mark this as another language')");
    languageIconAdd = this.page.locator(".add-languages-contextmenu-button");
    languageIconInitial = this.page.locator(".composer-panes-languageIcon");
    openManualRatings = this.page.locator(".rightPane >> .ratings-pane-item");
    replaceMediaItemButton = this.page.locator(".visual-properties-actions-action-label--cta:has-text(\"Replace media item\")");
}
