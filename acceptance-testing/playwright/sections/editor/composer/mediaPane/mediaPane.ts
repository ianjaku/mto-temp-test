import { MediaPaneLocators } from "./mediaPaneLocators";
import { TestSection } from "../../../testsection";

export class MediaPane extends TestSection {
    private locators = new MediaPaneLocators(this.context);
    async clickThumbnail(nth: number): Promise<void> {
        await this.locators.galleryVisual.nth(nth).click();
    }
}
