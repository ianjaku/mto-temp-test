import { NewCollectionModalLocators } from "./newcollectionmodalLocators";
import { TestSection } from "../../testsection";

export class NewCollectionModal extends TestSection {

    private readonly locators = new NewCollectionModalLocators(this.context);

    async fillName(name: string): Promise<void> {
        await this.locators.nameInput.fill(name);
    }

    async clickOk(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Set it up").click();
    }
}
