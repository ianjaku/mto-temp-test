/* eslint-disable no-console */
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { flatten } from "ramda";

const SCRIPT_NAME = "count-unique-videos";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);
const bindersRepository = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
const videoSet = new Set<string>()

async function processAccount(accountId: string) {
    // scroll throigh binders in account
    const scrollAge = 3600
    const batchSize = 100
    const query = {
        index: bindersRepository.getIndexName(),
        body: {
            query: {
                bool: {
                    must: {
                        term: {
                            accountId,
                        }
                    },
                    must_not: {
                        exists: {
                            field: "deletionTime"
                        }
                    }
                }
            },
        },
    }
    await bindersRepository.runScroll(query, scrollAge, batchSize, async (esBatch) => {
        for (const esItem of esBatch) {
            const binder = esItem["_source"]
            flatten(binder.modules.images.chunked[0].chunks)
                .filter(item => item.id.startsWith("vid"))
                .map(vid => videoSet.add(vid.id))
        }
    })
}

async function getAccountIds(accountClient: AccountServiceClient): Promise<string[]> {
    const accounts = await accountClient.listAccounts();
    return accounts
        .filter((account: Account) => account?.accountIsNotExpired)
        .map(a => a.id)
}

const doIt = async () => {
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const accountIds = await getAccountIds(accountClient)
    for (const accountId of accountIds) {
        try {
            await processAccount(accountId)
        } catch (err) {
            console.log(`Failed processing ${accountId}`);
            console.error(err);
        }
    }
    console.log(`Number of total unique videos found ${videoSet.size}`)
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

