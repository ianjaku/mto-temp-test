import { CookieBannerLocators } from "./cookiebannerlocators";
import { TestSection } from "../../testsection";


export class CookieBanner extends TestSection {

    private readonly locators = new CookieBannerLocators(this.context);

    async acceptCookies(): Promise<void>{
        await this.locators.cookiebannerButtonAccept.click();
        await this.locators.cookiebannerButtonAccept.waitFor({ state: "hidden" });
    }

    async declineCookies(): Promise<void>{
        await this.locators.cookiebannerButtonReject.click();
    }

}
