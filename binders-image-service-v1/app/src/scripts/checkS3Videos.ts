/* eslint-disable no-console */
import {
    Account,
    AccountServiceContract
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { VideoFormat, Visual, isVideo } from "../api/model";
import { any, splitEvery } from "ramda";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepository } from "../api/repositories/binderVisualRepository";
import { S3MediaStorage } from "../storage/s3";
import { processAll } from "../helper/batchProcess";

const hasS3Location = (videoFormat: VideoFormat) => {
    return videoFormat.storageLocation.startsWith(S3MediaStorage.getScheme());
}

const cachedAccountMapping: {[accountId: string]: Account} = { };

const getAccountName = async (accountId, accountServiceClient): Promise<Account> => {
    if (accountId in cachedAccountMapping) {
        return cachedAccountMapping[accountId];
    }
    const account = await accountServiceClient.getAccount(accountId);
    cachedAccountMapping[accountId] = account;
    return account;
}

type AccountStatistics = {
    [accountId: string]: {
        name: string,
        count: number,
        binderIds: string[],
        isExpired: boolean
    }
};

const groupResults = async (resultByBinder: { [binderId: string]: number },
    repoServiceClient: BinderRepositoryServiceClient,
    accountServiceClient: AccountServiceContract ) => {
    const allBinderIds = Object.keys(resultByBinder);
    const resultByAccount: AccountStatistics = {};
    const binderIdBatches = splitEvery(500, allBinderIds);
    for (const binderIds of binderIdBatches) {
        const binders = await repoServiceClient.findBindersBackend({ binderIds }, { maxResults: 5000 });
        for (const binder of binders) {
            const account = await getAccountName(binder.accountId, accountServiceClient);
            if (!(account.id in resultByAccount)) {
                resultByAccount[account.id] = {
                    name: account.name,
                    count: 0,
                    binderIds: [],
                    isExpired: account.expirationDate && new Date(account.expirationDate) < new Date(),
                };
            }
            resultByAccount[account.id].count += resultByBinder[binder.id];
            resultByAccount[account.id].binderIds.push(binder.id);
        }
    }
    return resultByAccount;
}

const printResults = (groupedResults: AccountStatistics ) => {
    let totalDocs = 0;
    let totalAccounts = 0;
    let totalVideos = 0
    let expiredAccounts = 0;
    let expiredVideos = 0;
    for (const accountId in groupedResults) {
        const { name, count, binderIds, isExpired } = groupedResults[accountId];
        console.log(`${name}${isExpired ? " (expired)" : "" } has ${count} docs (${binderIds.join(", ")}) and ${count} videos in total.`);
        totalAccounts++;
        totalDocs += binderIds.length;
        totalVideos += count;
        if (isExpired) {
            expiredAccounts++;
            expiredVideos += count;
        }
    }
    console.log("-----------------");
    console.log(`Grand total: ${totalDocs} (with ${totalVideos} videos overall and ${expiredVideos} expired videos) in ${totalAccounts} accounts (out of which ${expiredAccounts} are expired)`);
}

const doIt = async () => {
    const result: {[binderId: string]: number} = {};
    const processVisual = async (visual: Visual, _i: number, _repo: MongoBinderVisualRepository) => {
        if (!isVideo(visual)) {
            return;
        }
        const { binderId, formats } = visual;
        const isS3Video = any(hasS3Location, formats);
        if (!isS3Video) {
            return;
        }
        if (! (binderId in result)) {
            result[binderId] = 0;
        }
        result[binderId]++;
    }

    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "check-s3");
    await processAll(config, logger, processVisual);
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "check-s3-videos");
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "check-s3-videos");
    const formattedResult = await groupResults(result, repoServiceClient, accountServiceClient);
    printResults(formattedResult);
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