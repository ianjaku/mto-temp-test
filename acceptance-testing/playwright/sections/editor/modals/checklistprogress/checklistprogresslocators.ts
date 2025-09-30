import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../testsectionlocators";

export class ChecklistProgressLocator extends TestSectionLocators {

    completionColumn(index: number, text: string): Locator {
        return this.page.locator(`.checklist-progress .table tr:nth-child(${index+1}) td:nth-child(5) >> text=${text}`);
    }

    stepColumn(index: number, text: string): Locator {
        return this.page.locator(`.checklist-progress .table tr:nth-child(${index+1}) td:nth-child(6) >> text=${text}`);
    }
    
}
