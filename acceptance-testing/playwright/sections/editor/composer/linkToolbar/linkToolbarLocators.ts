import { TestSectionLocators } from "../../testsectionlocators";

export class LinkToolbarLocators extends TestSectionLocators {

    anchor = this.page.getByTestId("link-toolbar-anchor");
    editButton = this.page.getByTestId("link-toolbar-edit");
    removeButton = this.page.getByTestId("link-toolbar-remove");

}

