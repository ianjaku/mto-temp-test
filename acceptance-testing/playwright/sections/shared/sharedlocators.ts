import { Locator } from "playwright-core";
import { TestSectionLocators } from "../editor/testsectionlocators";

export interface ModalButtonLocatorOptions {
    waitForEnabled: boolean;
    modalHasText: string;
    isUnhoverable: boolean;
}

const defaultModalButtonLocatorOptions: ModalButtonLocatorOptions = {
    waitForEnabled: true,
    modalHasText: undefined,
    isUnhoverable: false,
};

export class SharedLocators extends TestSectionLocators {

    public getAutocompleteItem(text: string): Locator {
        return this.page.locator(`.autocomplete-prompt-item >> text=${text}`);
    }

    public getContextMenuItem(text: string): Locator {
        return this.page.locator(`.context-menu-popover-paper .contextMenu-item >> text="${text}"`);
    }

    public getButtonInModal(text: string, options = defaultModalButtonLocatorOptions): Locator {
        const modalLocator = this.page.locator(".modal", { hasText: options?.modalHasText });
        if (options?.waitForEnabled) {
            return modalLocator.locator(`.button:not(.button--disabled) >> text=${text}`);
        }
        if (options?.isUnhoverable) {
            return modalLocator.locator(`.button.button--unhoverable >> text=${text}`);
        }
        return modalLocator.locator(`.modal >> .button >> text=${text}`);
    }

    public getModalCloseButton(): Locator {
        return this.page.locator(".modal >> .modal-header >> .modal-closeBtn");
    }

    public getModalTitle(): Locator {
        return this.page.locator(".modal >> .modal-header-title");
    }

    public getRibbon(text: string): Locator {
        return this.page.locator(`.ribbon >> text=${text}`);
    }

    public getRibbonButton(text: string): Locator {
        return this.page.locator(`.ribbon >> .button >> text=${text}`);
    }
}
