import { TestSection } from "../../testsection";
import { TranslocationModalLocators } from "./translocationmodalLocators";
import { TreeNavigator } from "../treenavigator/treenavigator";

export class TranslocationModal extends TestSection {

    private readonly locators = new TranslocationModalLocators(this.context);

    clickOk(): Promise<void> {
        return this.sharedLocators.getButtonInModal("here").click();
    }

    get treeNavigator(): TreeNavigator {
        return new TreeNavigator(this.context);
    }

}
