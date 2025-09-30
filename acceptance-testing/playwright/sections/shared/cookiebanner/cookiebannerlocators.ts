import { TestSectionLocators } from "../../editor/testsectionlocators";

export class CookieBannerLocators extends TestSectionLocators {
    cookiebannerButtonAccept = this.page.locator(".cookieBanner-buttons >> text=Accept");
    cookiebannerButtonReject = this.page.locator(".cookieBanner-buttons >> text=Reject");
}
