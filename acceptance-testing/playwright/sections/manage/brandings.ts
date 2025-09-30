import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";

export class Brandings extends TestSection {

    private readonly locators = new BrandingLocators(this.context);

    async editBranding(domain: string) {
        const domainRow = this.locators.rowByDomain(domain);
        await domainRow.locator("button[title='Add custom branding']").click();
    }

    async fillIn(values: {
        backgroundColor?: string;
        headerBgColor?: string;
        headerFontColor?: string;
        primaryColor?: string;
        styleName?: string;
        systemFont?: string;
        textColor?: string;
        titleFont?: string;
        userFont?: string;
    }) {
        if (values.backgroundColor) await this.locators.backgroundColor.type(values.backgroundColor);
        if (values.headerBgColor) await this.locators.headerBgColor.type(values.headerBgColor);
        if (values.headerFontColor) await this.locators.headerFontColor.type(values.headerFontColor);
        if (values.primaryColor) await this.locators.primaryColor.type(values.primaryColor);
        if (values.styleName) await this.locators.styleName.type(values.styleName);
        if (values.systemFont) await this.locators.systemFont.type(values.systemFont);
        if (values.textColor) await this.locators.textColor.type(values.textColor);
        if (values.titleFont) await this.locators.titleFont.type(values.titleFont);
        if (values.userFont) await this.locators.userFont.type(values.userFont);
    }

    async clickSubmit() {
        await this.locators.submit.click();
    }

}

class BrandingLocators extends TestSectionLocators {

    backgroundColor = this.page.locator("input#secondColor");
    headerBgColor = this.page.locator("input#headerBgColor");
    headerFontColor = this.page.locator("input#headerFontColor");
    primaryColor = this.page.locator("input#firstColor");
    styleName = this.page.locator("input#styleName");
    submit = this.page.locator("button:has-text(\"Save\")")
    systemFont = this.page.locator("input#systemFont");
    textColor = this.page.locator("input#textColor");
    titleFont = this.page.locator("input#titleFont");
    userFont = this.page.locator("input#userFont");

    rowByDomain = (domain: string) => this.page.locator(`tr:has(.br-domain:text-is("${domain}"))`)

}

