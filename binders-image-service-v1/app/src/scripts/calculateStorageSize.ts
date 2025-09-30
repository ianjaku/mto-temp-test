/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { MongoBinderVisualRepository, MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import { Visual, VisualFormat } from "../api/model";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { VisualUsage } from "@binders/client/lib/clients/imageservice/v1/contract";

const SCRIPT_NAME = "calculate-storage-size";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);



async function getUsedVisuals(binderVisualRepo: MongoBinderVisualRepository, binderId: string): Promise<Visual[]> {
    return binderVisualRepo.listBinderVisuals(binderId, VisualUsage.BinderChunk);
}

async function getDeletedVisuals(binderVisualRepo: MongoBinderVisualRepository, binderId: string): Promise<Visual[]> {
    return binderVisualRepo.listBinderDeletedVisuals(binderId)
}

async function calculateVisualsSize(visuals: Visual[]) {
    let totalSize = 0
    for (const visual of visuals) {
        const formats = visual.formats as VisualFormat[]
        const visualsSize = formats
            .map((format: VisualFormat) => format.size)
            .reduce((acc, curr) => acc + curr, 0)
        totalSize += visualsSize
    }
    return totalSize
}

async function calculateTotalSizeOfUsedVisualsInBinder(binderVisualRepo: MongoBinderVisualRepository, binderId: string) {
    const visuals = await getUsedVisuals(binderVisualRepo, binderId)
    console.log(`Found ${visuals.length} visuals in ${binderId} binder`)
    return calculateVisualsSize(visuals)
}

async function calculateTotalSizeOfDeletedVisuals(binderVisualRepo: MongoBinderVisualRepository, binderId: string) {
    const visuals = await getDeletedVisuals(binderVisualRepo, binderId)
    return calculateVisualsSize(visuals)
}

async function calculateStorageSize(accountId: string) {
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const binderIds = await repoServiceClient.findBinderIdsByAccount(accountId);
    const binderVisualRepository = await getBinderVisualRepository()
    let inUseVisualsSize = 0, deletedVisualsSize = 0;
    const numberOfBinders = binderIds.length
    for (let i = 0; i < numberOfBinders; i++) {
        const binderId = binderIds[i]
        const partialInUseVisualSize = await calculateTotalSizeOfUsedVisualsInBinder(binderVisualRepository, binderId)
        const partialdeletedVisualsSize = await calculateTotalSizeOfDeletedVisuals(binderVisualRepository, binderId)
        inUseVisualsSize += partialInUseVisualSize;
        deletedVisualsSize += partialdeletedVisualsSize;
        console.log(`Calculated binder ${binderId}, in use visual inside binder: ${partialInUseVisualSize}, deleted visual inside: ${partialdeletedVisualsSize}`)
    }
    return {
        deletedVisualsSize,
        inUseVisualsSize
    }
}

async function getAccountIds(accountClient: AccountServiceClient): Promise<string[]> {
    const id = process.argv[2]
    let accounts = []
    if (id && id.startsWith("aid-")) {
        const account = await accountClient.getAccount(id);
        return [account.id]
    } else {
        accounts = await accountClient.listAccounts();
    }
    const performFullRun = id === "all"
    if (!performFullRun) {
        return accounts
            .filter((account: Account) => account?.storageDetails?.dirty)
            .map(a => a.id)
    }
    return accounts.map(account => account.id)
}

function bytesToSize(bytes: number): string {
    const sizes: string[] = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "n/a"
    const i: number = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString())
    if (i === 0) return `${bytes} ${sizes[i]}`
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

const doIt = async () => {
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const accountIds = await getAccountIds(accountClient)
    for (const accountId of accountIds) {
        try {
            const { inUseVisualsSize, deletedVisualsSize } = await calculateStorageSize(accountId)
            const storageDetails = {
                deletedVisualsSize,
                dirty: false,
                inUseVisualsSize
            }
            await accountClient.updateStorageDetails(accountId, storageDetails)
            console.log(`Account ${accountId} have ${bytesToSize(inUseVisualsSize)} in use visual size and ${bytesToSize(deletedVisualsSize)} size`)
        } catch (err) {
            console.log(`Failed processing ${accountId}`);
            console.error(err);
        }
    }
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

async function getBinderVisualRepository() {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    return new MongoBinderVisualRepositoryFactory(collectionConfig, logger).build(logger);
}