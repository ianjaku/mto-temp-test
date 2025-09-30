import { Locator } from "playwright-core";
import { TestContext } from "../../testcontext";
import { TestSectionLocators } from "../testsectionlocators";

export class UsersLocators extends TestSectionLocators {

    public readonly manageUsers: ManageUsersLocators;
    public readonly importUsers: ImportUsersLocators;
    public readonly approvedEmails: ApprovedEmailsLocators;

    constructor(context: TestContext) {
        super(context);
        this.manageUsers = new ManageUsersLocators(context);
        this.importUsers = new ImportUsersLocators(context);
        this.approvedEmails = new ApprovedEmailsLocators(context);
    }

    getUserAdministrationSwitchButton(): Locator {
        return this.page.getByRole("link", { name: "Users" });
    }

    getActiveTab(): Locator {
        return this.page.locator(".tabs-nav-list >> .tabs-item.active >> .tabs-title");
    }

    getTabWithName(tab: string): Locator {
        return this.page.locator(`.tabs-nav-list >> .tabs-title >> text=${tab}`);
    }
}

class ManageUsersLocators extends TestSectionLocators {

    getDeleteUserButton(login: string): Locator {
        return this.page.locator(`tr:has(td:has(span:text("${login}"))) td:has(label[title="Remove user from account"])`);
    }

    getDeleteUserButtonConfirmation(): Locator {
        return this.page.locator(".button >> text='OK'");
    }

    getUserRow(login: string): Locator {
        return this.page.locator(`tr:has(td:has(span:text("${login}")))`);
    }
}

class ImportUsersLocators extends TestSectionLocators {

    getOpenImportModalButton(): Locator {
        return this.page.locator(".button >> text='New user import'");
    }

    getUploadCsvFileButton(): Locator {
        return this.page.locator(".file-selector >> .button >> text='Select a .csv file'");
    }

    getConfirmCsvFileImportButton(): Locator {
        return this.page.locator(".button >> text='Import'");
    }
}

class ApprovedEmailsLocators extends TestSectionLocators {

    getNewApprovedEmailButton(): Locator {
        return this.page.locator(".button >> text='New approved email'");
    }

    getApprovedEmailPatternInput(): Locator {
        return this.page.locator(".modal-body >> input");
    }

    getConfirmApprovedEmailPatternButton(): Locator {
        return this.page.locator(".modal-footer >> .button >> text='Add'");
    }
}
