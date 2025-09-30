import { TestSectionLocators } from "../../testsectionlocators";

export class LinkEditorLocators extends TestSectionLocators {

    linkTitle = this.page.getByTestId("input-linktitle");
    link = this.page.getByTestId("input-link");
    saveButton = this.page.getByTestId("button-linksave");
    validationError = this.page.getByTestId("link-editor-error");
}

