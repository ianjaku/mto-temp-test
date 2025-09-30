import { SearchLocators } from "./searchlocators";
import { TestSection } from "../../testsection";
import { expect } from "@playwright/test";


export class Search extends TestSection {

    private readonly locators = new SearchLocators(this.context);

    async fillQueryAndSubmit(query: string): Promise<void> {
        await this.locators.searchInput.fill(query);
        await this.locators.searchInput.press("Enter");
    }

    async expectNumberOfResults(number: number): Promise<void> {
        await expect(this.locators.anySearchResult).toHaveCount(number, { timeout: 20000 });
    }

}
