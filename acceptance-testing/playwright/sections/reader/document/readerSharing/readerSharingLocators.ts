import { TestSectionLocators } from "../../../editor/testsectionlocators";

export class ReaderSharingLocators extends TestSectionLocators {

    readerSharingTriggerButton = this.page.locator(".material-icons >> text=share");
    readerSharingModal = this.page.locator(".sharingModal");

    copyLinkButton = this.page.locator(".sharingModal >> text='Copy link'");
    closeButton = this.page.locator(".sharingModal >> text='Close'");
    qrCodeCanvas = this.page.locator(".sharingModal >> canvas");
    
}
