import { TestSection } from "../../testsection";
import { TreenavigatorLocators } from "./treenavigatorLocators";

export class TreeNavigator extends TestSection {

    private readonly locators = new TreenavigatorLocators(this.context);

    async toParent(): Promise<void> {
        await this.locators.parentBtn.click();
    }

}
