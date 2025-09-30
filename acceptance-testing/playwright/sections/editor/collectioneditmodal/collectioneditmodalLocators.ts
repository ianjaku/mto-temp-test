import { Locator } from "playwright-core";
import { TestSectionLocators } from "../testsectionlocators";

export class CollectionEditModalLocators extends TestSectionLocators {

    getNameInputOnIndex(index: number): Locator {
        return this.page.locator(`.collectionForm-table tr:nth-child(${index + 1}) >> input[placeholder="Collection name"]`)
    }

    semanticLinkInput(): Locator {
        return this.page.locator(".semanticLinkManager input[placeholder=\"Enter link here\"]")
    }

    getSemanticLinkContextMenuTrigger(semanticLink: string): Locator {
        return this.page.getByTestId(`semanticLinkManagerInput-ctx-trigger-${semanticLink}`);
    }

    getSemanticLinkContextMenuItem(item = "qr"): Locator {
        return this.page.getByTestId(`semanticLinkManagerInput-ctx-item-${item}`);
    }

    clipboardIcon(): Locator {
        return this.page.getByTestId("qrCodeAndShareLinks-clipboardIcon");
    }

    modalTitleContainingText(text: string): Locator {
        return this.page.locator(`.collectionForm-modal >> .modal-header-title:has-text("${text}")`);
    }

    getTabWithName(name: string): Locator {
        return this.page.locator(`.tabs-item >> .tabs-title:has-text("${name}")`);
    }
}
