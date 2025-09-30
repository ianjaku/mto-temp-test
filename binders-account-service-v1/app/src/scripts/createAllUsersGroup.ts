/* eslint-disable no-console */
import { ALL_USERS_GROUP, Account, AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendAccountServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { UserServiceContract } from "@binders/client/lib/clients/userservice/v1/contract";


const getAccounts = async (accountService: AccountServiceContract): Promise<Account[]> => {
    if (process.argv.length < 3) {
        return accountService.listAccounts();
    }
    const accountId = process.argv[2];
    return [
        await accountService.getAccount(accountId)
    ];
}

const createGroups = async (userService: UserServiceContract, accounts: Account[] ) => {
    const totalAccounts = accounts.length;
    let i = 0;
    for (const account of accounts) {
        const { id, members, name } = account;
        i++;
        console.log(`Processing account ${name} (${i} / ${totalAccounts})`);
        await userService.multiAddGroupMembers(
            id,
            {
                names: [ ALL_USERS_GROUP ]
            },
            members,
            {
                createGroupIfDoesntExist: true,
                makeNewUsergroupReadonly: true,
                makeNewUsergroupAutoManaged: true,
            }
        )
    }
}

const doIt = async () => {
    const config = BindersConfig.get();
    const SCRIPT_NAME = "create-all-users";
    const accountContract = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const userContract = await BackendUserServiceClient.fromConfig(config, SCRIPT_NAME);
    const accounts = await getAccounts(accountContract);
    await createGroups(userContract, accounts);
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)