import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class ReaderFeedbackSettingsModalLocators extends TestSectionLocators {

    private overrideText = "Specify feedback settings";
    private inheritText = "Use feedback settings from parent collections";
    private manualRatingText = "Reviews";
    private readerCommentsText = "Reader comments";
    private readConfirmationText = "Read confirmation";

    overrideBtn: Locator = this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection .MuiFormControlLabel-root:has-text('${this.overrideText}') >> input[type=radio]`)

    public goToParent(title: string): Locator {
        return this.page.locator(`.readerfeedbackSettings .collectionLink >> label:has-text('${title}')`).nth(0)
    }

    public getRatingToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:not(:has-text('${this.inheritText}'))
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.manualRatingText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getCommentsToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:not(:has-text('${this.inheritText}'))
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.readerCommentsText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getReadConfirmationToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:not(:has-text('${this.inheritText}'))
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.readConfirmationText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getParentRatingToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:has-text('${this.inheritText}')
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.manualRatingText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getParentCommentsToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:has-text('${this.inheritText}')
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.readerCommentsText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getParentReadConfirmationToggle(on?: boolean): Locator {
        const maybeOn = on ? ".Mui-checked" : ":not(.Mui-checked)"
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:has-text('${this.inheritText}')
        >> .readerfeedbackSetting-checkboxwrapper:has-text('${this.readConfirmationText}')
        >> .MuiCheckbox-root${on === undefined ? "" : maybeOn}`);
    }

    public getUseParentSettingsToggleWithValue(expectedValue: boolean): Locator {
        return this.page.locator(`.readerfeedbackSettings .inheritedSettingsSection:has-text('${this.inheritText}')
        >> .inheritedSettingsNavigator-radiobuttonWrapper
        >> .MuiRadio-root${expectedValue ? ".Mui-checked" : ":not(.Mui-checked)"}`);
    }
}
