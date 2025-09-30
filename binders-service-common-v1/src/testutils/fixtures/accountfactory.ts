import { Account, AccountServiceContract, SecuritySettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendAccountServiceClient, BackendRoutingServiceClient, } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config";
import { createTestAccount } from "../cleanup";


export class TestAccountFactory {

    private accountId: string = null;
    private creatingAccount = false;
    private creatingAccountListeners: (() => void)[] = [];

    constructor(
        private readonly config: Config
    ) { }


    public addMember: AccountServiceContract["addMember"] = async (accountId, userId, manageMemberTrigger) => {
        const accountClient = await BackendAccountServiceClient.fromConfig(this.config, "testing");
        return accountClient.addMember(accountId, userId, manageMemberTrigger)
    }

    public async getFreshAccount(fullAccountName: string): Promise<Account> {
        const account = await createTestAccount(fullAccountName);
        const routingClient = await BackendRoutingServiceClient.fromConfig(this.config, "testing");
        const domain = `test-${account.id}.manual.to`;
        await routingClient.setDomainsForAccount(account.id, [domain]);
        return account;
    }

    public async getPrefixedFreshAccount(accountNamePrefix: string, accountName?: string): Promise<Account> {
        const fullAccountName = accountName != null ?
            accountNamePrefix + "__" + accountName :
            accountNamePrefix;
        return this.getFreshAccount(fullAccountName);
    }

    public async getAnyAccount(accountName?: string): Promise<string> {
        if (this.accountId != null) return this.accountId;
        if (this.creatingAccount) {
            await new Promise(resolve => {
                this.creatingAccountListeners.push(() => {
                    resolve("");
                })
            });
            return this.accountId;
        }

        const account = await this.getFreshAccount(accountName);
        this.accountId = account.id;

        if (this.creatingAccountListeners.length > 0) {
            this.creatingAccount = false;
            this.creatingAccountListeners.forEach(cb => cb());
            this.creatingAccountListeners = [];
        }
        return this.accountId;
    }

    async setAccountSecuritySettings(accountId: string, settings: SecuritySettings): Promise<void> {
        const client = await BackendAccountServiceClient.fromConfig(this.config, "testing");
        await client.setAccountSecuritySettings(accountId, settings);
    }

}
