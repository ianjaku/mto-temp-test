import { CollectionEditModalLocators } from "./collectioneditmodalLocators";
import { TestSection } from "../../testsection";

export class CollectionEditModal extends TestSection {

    private readonly locators = new CollectionEditModalLocators(this.context);

    async fillNameOnIndex(rowIndex: number, name: string): Promise<void> {
        await this.locators.getNameInputOnIndex(rowIndex).fill(name);
    }

    async clickDone(): Promise<void> {
        await this.sharedLocators.getButtonInModal("Done").click();
    }

    async fillSemanticLinkInput(semanticLink: string): Promise<void> {
        await this.locators.semanticLinkInput().fill(semanticLink);
        await this.locators.semanticLinkInput().blur();
    }

    async clickSemanticLinkContextMenuTrigger(semanticLink: string): Promise<void> {
        await this.locators.getSemanticLinkContextMenuTrigger(semanticLink).click();
    }

    async clickSemanticLinkContextMenuItem(item = "qr"): Promise<void> {
        await this.locators.getSemanticLinkContextMenuItem(item).click();
    }

    async clickCopyLink(): Promise<void> {
        await this.locators.clipboardIcon().click();
    }

    async assertModalTitleContains(text: string): Promise<void> {
        await this.locators.modalTitleContainingText(text).waitFor({ timeout: 10_000 });
    }

    async switchToTab(tabName: string): Promise<void> {
        await this.locators.getTabWithName(tabName).click();
    }
}
