import { Locator } from "playwright-core";
import { TestSectionLocators } from "../../editor/testsectionlocators";

export class StoryBrowserLocators extends TestSectionLocators {

    stories = this.page.locator(".story-list .story-item");

    public itemWithProgressBarValue(itemTitle: string, percentage: number) {
        return this.page
            .locator(`.story-list .story-item:has-text('${itemTitle}')`)
            .locator(`.progress-bar .value:has-text('${percentage}%')`);
    }

    public storyByTitle(title: string, exact = false): Locator {
        const match = exact ? new RegExp(`^${title}$`) : title;
        return this.page.locator(".story-list .title-wrapper", { hasText: match });
    }

    public loggedInUser(user: string): Locator {
        return this.page.locator(`.userWidget-container :text("${user}")`);
    }

    public emptyCollectionMessage(): Locator {
        return this.page.locator(".empty-collection__message");
    }

}
