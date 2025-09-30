import { getVisualIds, waitForVisualIdsToChange } from "../../../../shared/api/image";
import { CommentsPane } from "./commentsPane/commentsPane";
import { PublishingPane } from "./publishingPane/publishingPane";
import { RightPaneLocators } from "./rightPaneLocators";
import { SharePane } from "./sharePane/sharePane";
import { TestSection } from "../../testsection";

export class RightPane extends TestSection {

    private readonly locators = new RightPaneLocators(this.context);

    get comments(): CommentsPane {
        return new CommentsPane(this.context);
    }

    get share(): SharePane {
        return new SharePane(this.context);
    }

    get publishing(): PublishingPane {
        return new PublishingPane(this.context);
    }

    async addLanguage(language: string): Promise<void> {
        await this.locators.languageIconAdd.click();
        await this.locators.addANewLanguageButton.click();
        await this.locators.languageDropdown.type(language);
        await this.locators.languageDropdownFirstElement.click();
    }

    async closeMediaPane(): Promise<void> {
        await this.locators.closeMediaPaneButton.click();
    }

    /**
     * Downloads the exported ratings and returns the path to the file
     */
    async downloadManualRatings(): Promise<string> {
        const downloadPromise = this.context.page.waitForEvent("download");
        await this.locators.downloadManualRatingsButton.click();
        const download = await downloadPromise;
        const path = `/tmp/exports/feedbacks/${download.suggestedFilename()}`;
        await download.saveAs(path);
        return path;
    }

    async getBinderId(): Promise<string> {
        const url = this.page.url();
        const withoutQuery = url.split("?").shift();
        return withoutQuery.split("/").pop();
    }

    async openManualRatings(): Promise<void> {
        await this.locators.openManualRatings.click();
    }

    async replaceVisual(fileName: string): Promise<string[]> {
        const binderId = await this.getBinderId();
        const visualIds = await getVisualIds(binderId);
        const fileChooserPromise = this.page.waitForEvent("filechooser");
        await this.locators.replaceMediaItemButton.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(fileName);
        return await waitForVisualIdsToChange(binderId, visualIds, true);
    }

    /**
     * @param language Must be a value that appears in the languages dropdown
     */
    async setPrimaryLanguage(language: string, canDetectPrimaryLanguage: boolean): Promise<void> {
        await this.locators.languageIconInitial.click();
        if (canDetectPrimaryLanguage) {
            await this.locators.languageDropDownMarkAs.waitFor({
                state: "visible"
            });
            await this.locators.languageDropDownMarkAs.click();
        }
        await this.locators.languageDropdown.type(language);
        await this.locators.languageDropdownFirstElement.click();
    }

    async setBackgroundColor(color: string): Promise<void> {
        await this.locators.backgroundColorPickerButton.click();
        await this.locators.backgroundColorPickerModalInput.fill(color);
        await this.locators.backgroundColorPickerModalInput.press("Enter");
    }

}
