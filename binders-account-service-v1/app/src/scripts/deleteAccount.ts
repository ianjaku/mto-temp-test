/* eslint-disable no-console */
import * as readline from "readline";
import {
    AccountFeaturesRepository,
    MongoAccountFeaturesRepositoryFactory
} from "../accountservice/repositories/accountFeatures";
import {
    AccountLicensingRepository,
    MongoLicensingRepositoryFactory
} from "../accountservice/repositories/licensing";
import {
    AccountMembershipRepository,
    MongoAccountMembershipRepositoryFactory
} from "../accountservice/repositories/accountMemberships";
import {
    AccountRepository,
    MongoAccountRepositoryFactory
} from "../accountservice/repositories/accounts";
import {
    BackendRepoServiceClient,
    BackendRoutingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { AccountIdentifier } from "../accountservice/model";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
const config = BindersConfig.get();
const loginOption = getMongoLogin("account_service");
const logger = LoggerBuilder.fromConfig(config);

const { accountId } = (() => {
    if (process.argv.length !== 3 || !(process.argv[2].startsWith("aid-"))) {
        console.error(`Usage: node ${__filename} <ACCOUNTID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
    };
})();

async function getClients(): Promise<{
    accountsRepo: AccountRepository,
    accountFeaturesRepo: AccountFeaturesRepository,
    accountLicensingRepo: AccountLicensingRepository,
    accountMembershipRepo: AccountMembershipRepository,
    repoServiceClient: BinderRepositoryServiceClient,
    authServiceClient: AuthorizationServiceClient,
    routingServiceClient: RoutingServiceClient,
}> {
    const accountsCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "accounts",
        loginOption,
    );
    const afCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "accountFeatures",
        loginOption,
    );
    const licensingCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "licensing",
        loginOption,
    );
    const amsCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "accountMemberships",
        loginOption
    );

    const accountsRepo = new MongoAccountRepositoryFactory(accountsCollectionConfig, logger).build(logger);
    const accountFeaturesRepo = new MongoAccountFeaturesRepositoryFactory(afCollectionConfig, logger).build(logger);
    const accountLicensingRepo = new MongoLicensingRepositoryFactory(licensingCollectionConfig, logger).build(logger);
    const accountMembershipRepo = new MongoAccountMembershipRepositoryFactory(amsCollectionConfig, logger).build(logger);
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "delete-account");
    const authServiceClient = await BackendAuthorizationServiceClient.fromConfig(config, "delete-account");
    const routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "delete-account");
    return {
        accountsRepo,
        accountFeaturesRepo,
        accountLicensingRepo,
        accountMembershipRepo,
        repoServiceClient,
        authServiceClient,
        routingServiceClient,
    };
}

async function confirm(accountName: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(`Are you sure you want to delete the account "${accountName}" and all of its content?\nType "${accountName}" to continue: `, function (answer) {
            resolve(answer === accountName);
        });
    });
}

const doIt = async () => {
    const { accountsRepo, accountFeaturesRepo, accountLicensingRepo, accountMembershipRepo, repoServiceClient, authServiceClient, routingServiceClient } = await getClients();
    const account = await accountsRepo.getAccount(new AccountIdentifier(accountId));
    if (!account) {
        return;
    }

    if (!(await confirm(account.name))) {
        console.log("Answer doesn't match - not deleting")
        process.exit(0);
    }

    console.log("Deleting...");

    const rootCollections = await repoServiceClient.findCollections({ rootCollections: [accountId] }, { maxResults: 1 });

    if ((rootCollections || []).length) {

        const rootCollection = rootCollections[0];

        console.log(`rootCollection: ${rootCollection.id} with ${rootCollection.elements.length} elements`);
        for await (const item of rootCollection.elements) {
            if (item.kind === "collection") {
                console.log(`recursively deleting child collection ${item.key}...`);
                const languagesUsed = await repoServiceClient.getLanguageCodesUsedInCollection(item.key);
                console.log(`- languagesUsed: ${languagesUsed}`);
                await repoServiceClient.recursiveUnpublish(item.key, languagesUsed.map(l => l.languageCode), accountId);
                console.log("- everything unpublished");
                await repoServiceClient.recursiveDelete(item.key, accountId, rootCollection.id);
                console.log("- everything deleted");
            } else {
                console.log(`deleting child document ${item.key}`);
                await repoServiceClient.deleteBinder(item.key, accountId);
            }
        }
        console.log(`deleting root collection ${rootCollection.id}`);
        await repoServiceClient.deleteCollection(rootCollection.id, accountId);
    }

    const acls = await authServiceClient.accountAcls(accountId);
    for await (const aclId of (acls || []).map(acl => acl.id)) {
        console.log(`deleting acl ${aclId}`)
        try {
            await authServiceClient.deleteAcl(aclId, accountId);
        } catch (e) {
            console.error(`error in deleting acl ${aclId}: ${e.message || e}. Already deleted? (fetched results might be stale due to cached authorization client)`);
        }
    }
    console.log("deleting account features...");
    await accountFeaturesRepo.deleteAccountFeatures(accountId);

    console.log("deleting account licensing entry...");
    await accountLicensingRepo.deleteLicensing(accountId);

    console.log("deleting account memberships entry...");
    await accountMembershipRepo.deleteAccountMembership(accountId);

    const domainFilters = await routingServiceClient.getDomainFiltersForAccounts([accountId]);
    for await (const domainFilter of domainFilters) {
        const { domain } = domainFilter;
        console.log("found domainfilter: domain", domain);
        console.log("deleting domainfilter...");
        await routingServiceClient.deleteDomainFilter(domain);
        const readerBranding = await routingServiceClient.getBrandingForReaderDomain(domain);
        if (readerBranding.domain) {
            console.log("deleting readerBranding...");
            await routingServiceClient.deleteReaderBranding(readerBranding);
        }
    }

    console.log("deleting account...");
    await accountsRepo.deleteAccount(new AccountIdentifier(accountId), true);
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    (err) => {
        console.error("Something went wrong!");
        console.error(err);
        process.exit(1);
    }
)
