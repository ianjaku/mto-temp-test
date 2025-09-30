import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class BrowseLocators extends TestSectionLocators {

    public emptyCollectionLbl = this.page.locator("text=This collection is empty!");
    public activeNewButton = this.page.locator(".navbar-create-button:not(.navbar-create-button--disabled) >> visible=true");
    public fallbackError = this.page.locator(".fallback-errorMessageException");
    public newButton = this.page.locator(".navbar-create-button >> visible=true");
    public newCollectionOption = this.page.locator(".contextMenu-item-option >> text=Collection >> visible=true");
    public newDocumentOption = this.page.locator("[data-testid='add-new-document-default']:visible");

    public getItem(itemName: string): Locator {
        return this.page.locator(".library-row", { hasText: itemName })
    }

    public getLoadedItem(itemName: string): Locator {
        return this.page.locator(".library-row:not(.library-row--pending)", { hasText: itemName });
    }

    public getUnpublishedItem(itemName: string): Locator {
        return this.page.locator(`.library-row-document-no-items >> text=${itemName}`);
    }

    public getItemContextMenu(itemName: string): Locator {
        return this.getItem(itemName).locator("button[aria-label='more'][aria-controls='long-menu']");
    }

    public getItemShareButton(itemName: string): Locator {
        return this.getItem(itemName).getByTestId("browse-share-button");
    }

    public getItemViews(itemName: string): Locator {
        return this.getItem(itemName).locator(".statistics .amount")
    }

    public lockedItem(itemName: string): Locator {
        return this.page.locator(".library-row.is-locked", { hasText: itemName });
    }

    public itemWithProgressBarValue(itemTitle: string, percentage: number) {
        return this.page
            .locator(`.library-row:has-text('${itemTitle}')`)
            .locator(`.progress-bar .value:has-text('${percentage}%')`);
    }

}
