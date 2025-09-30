import { HomeLocators } from "./homeLocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";

export class Home extends TestSection {

    private readonly locators = new HomeLocators(this.context);

    async expectNothingToDo(): Promise<void> {
        await expect(this.locators.noActivitiesMessage).toBeVisible();
    }

    async expectActivity(pattern: string) {
        await expect(this.locators.activityBody(pattern)).toBeVisible();
    }

}
