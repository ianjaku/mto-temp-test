import { TestSection } from "../testsection";
import { TestSectionLocators } from "../editor/testsectionlocators";
import { expect } from "@playwright/test";

export class Accounts extends TestSection {

    private readonly locators = new AccountEditorLocators(this.context);

    async expectSubmitState(state: "enabled" | "disabled") {
        if (state === "disabled") {
            expect(await this.locators.submit.isDisabled()).toBe(true);
        }
        if (state === "enabled") {
            expect(await this.locators.submit.isDisabled()).toBe(false);
        }
    }

    async fillIn({ accountName, maxNoLicenses, maxNoPublicDocs }: {
        accountName?: string;
        maxNoLicenses?: string;
        maxNoPublicDocs?: string;
    }) {
        if (accountName) await this.locators.accountName.type(accountName);
        if (maxNoPublicDocs) await this.locators.maxNoPublicDocs.type(maxNoPublicDocs);
        if (maxNoLicenses) await this.locators.maxNoLicenses.type(maxNoLicenses);
    }

    async clickSubmit() {
        await this.locators.submit.click();
    }

    async createNew() {
        await this.locators.newAccount.click();
    }

    async assertDomainNotAssigned(domain: string) {
        await this.locators.allAccountNameCells.first().waitFor();
        const allCount = await this.locators.allAccountNameCells.count();
        const count = await this.locators.accountDomainsCell(domain).count();
        if (allCount > 0 && count > 0) {
            throw new Error(`The domain ${domain} is already assigned to ${count} accounts`);
        }
    }

    async clickDomains(accountName: string) {
        await this.locators.rowByAccountName(accountName).locator(".acc-domains button").click();
    }

    async getAccountId(accountName: string) {
        return await this.locators.rowByAccountName(accountName).locator(".acc-id").textContent();
    }
}

class AccountEditorLocators extends TestSectionLocators {

    accountName = this.page.locator("input[placeholder='Account name']");
    maxNoLicenses = this.page.locator("input[placeholder='Maximum number of licenses']");
    maxNoPublicDocs = this.page.locator("input[placeholder='Maximum number of public documents']");
    newAccount = this.page.locator("button:has-text('Create')")
    submit = this.page.locator("button:has-text(\"Save\")")

    allAccountNameCells = this.page.locator(".acc-name")
    accountDomainsCell = (domain: string) => this.page.locator(`.acc-domains label:text-is("${domain}")`)
    rowByAccountName = (name: string) => this.page.locator(`tr:has(.acc-name:text-is("${name}"))`)

}

