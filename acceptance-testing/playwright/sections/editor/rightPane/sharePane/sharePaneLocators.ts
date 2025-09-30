import { TestSectionLocators } from "../../testsectionlocators";
import ts from "@binders/client/lib/i18n/translations/en_US";

export class SharePaneLocators extends TestSectionLocators {

    openPaneButton = this.page.locator(".rightPane >> .pane-item-icon:has-text(\"share\")");
    semanticLinkContext = this.page.locator(".semanticLinkManager-row-rightctrl");
    addSemanticLinkButton = this.page.locator(".button-add-semanticLink");
    addSemanticLinkContextOption = this.page.locator(`span:has-text("${ts.DocManagement_SemLinkCtxAdd}")`);
    semanticLinkManager = this.page.locator(".semanticLinkManager");

    getSemanticLinkContextForLanguageCode = (languageCode: string, rowIndex = 0) => {
        return this.page
            .locator(`.semanticLinkManager-set[data-languagecode="${languageCode}"] >> .semanticLinkManager-row`)
            .nth(rowIndex)
            .locator(".semanticLinkManager-row-rightctrl");
    }

    getNewSemanticLinkInput = (languageCode: string) => {
        return this.page
            .locator(`.semanticLinkManager-set[data-languagecode="${languageCode}"] >> .semanticLinkManager-row`)
            .locator(".semanticLinkManagerInput-txt--isNewInput");
    }

}