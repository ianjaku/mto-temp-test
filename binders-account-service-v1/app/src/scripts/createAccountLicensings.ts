/* eslint-disable no-console */
import { AccountIdentifier, AccountLicensing } from "../accountservice/model";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoAccountRepositoryFactory } from "../accountservice/repositories/accounts";
import { MongoLicensingRepositoryFactory } from "../accountservice/repositories/licensing";
import { difference } from "ramda";

let licensesCreated = 0;

const config = BindersConfig.get();
const loginOption = getMongoLogin("account_service");
const logger = LoggerBuilder.fromConfig(config);

interface AccountLicensingInformation {
    id: AccountIdentifier;
    name: string;
    maxPublicCount: number;
    totalMembers: number;
    maxNumberOfUsers: number;
}

const doIt = async() => {
    const licensingCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "licensing",
        loginOption,
    );
    const accountsCollectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "accounts",
        loginOption,
    );
    const licensingRepo = new MongoLicensingRepositoryFactory(licensingCollectionConfig, logger).build(logger);
    const accountsRepo = new MongoAccountRepositoryFactory(accountsCollectionConfig, logger).build(logger);

    const allAccountsDaos = await accountsRepo.findRawAccounts();
    const bindersAccount = allAccountsDaos.find(a => a.accountId === "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6");
    const bindersMembers = bindersAccount.members;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allAccounts: AccountLicensingInformation[] = allAccountsDaos.map((dao: any) => ({
        id: new AccountIdentifier(dao.accountId),
        name: dao.name,
        maxPublicCount: dao["maxPublicCount"] || null,
        totalMembers: (difference(dao.members, bindersMembers) || []).length,
        maxNumberOfUsers: dao.maxNumberOfUsers || null,
    }));

    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "create-account-licensing");

    for (const account of allAccounts) {
        console.log("creating licensing for account:", account.name);
        const totalPublicDocuments = await repoServiceClient.countAllPublicDocuments(account.id.value());
        const licensing = new AccountLicensing(
            account.id.value(),
            totalPublicDocuments,
            account.maxPublicCount,
            account.totalMembers,
            account.maxNumberOfUsers,
        );
        await licensingRepo.saveLicensing(licensing);
        licensesCreated += 1;
    }
}

doIt()
    .then(() => {
        console.log(`Created ${licensesCreated + 1} licenses information`);
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.error("Something went wrong");
        console.error(error);
        process.exit(1);
    });