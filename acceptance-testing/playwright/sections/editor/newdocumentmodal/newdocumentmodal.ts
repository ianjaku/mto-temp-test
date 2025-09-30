import { NewDocumentModalLocators } from "./newdocumentmodalLocators";
import { TestSection } from "../../testsection";

export class NewDocumentModal extends TestSection {

    private readonly locators = new NewDocumentModalLocators(this.context);

    async clickOk(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Set it up").click();
    }

    async selectCollection(name: string): Promise<void> {
        await this.locators.collection(name).click();
    }

}
