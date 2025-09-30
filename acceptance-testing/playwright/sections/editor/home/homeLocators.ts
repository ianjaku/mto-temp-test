import TK_US from "@binders/client/lib/i18n/translations/en_US";
import { TestSectionLocators } from "../testsectionlocators";

export class HomeLocators extends TestSectionLocators {

    public noActivitiesMessage = this.page.locator(`text=${TK_US.HomePage_NothingToDoMessage}`);

    activityBody(pattern: string) {
        return this.page.locator(`.activity-body-message:has-text("${pattern}")`);
    }
}
