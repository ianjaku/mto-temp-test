import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class TreenavigatorLocators extends TestSectionLocators {
    parentBtn: Locator = this.page.locator(".tree-navigator-parent-back");


}
