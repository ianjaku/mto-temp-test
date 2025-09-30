import { TestSectionLocators } from "../testsectionlocators";

export class SearchLocators extends TestSectionLocators {

    searchInput = this.page.locator("[placeholder=\"Search for documents and collections\"]");
    anySearchResult = this.page.locator(".search-results-items .library-row")
    
}
