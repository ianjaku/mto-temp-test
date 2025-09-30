import { log, main } from "@binders/binders-service-common/lib/util/process";
import { subMonths, subYears } from "date-fns";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ESQueryBuilder } from "@binders/binders-service-common/lib/elasticsearch/builder";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { performance } from "perf_hooks";


const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, "reindex-useractions");
const SCRIPT_NAME = "run-test-queries"

async function runTestCase(testCase: string, query: Record<string, unknown>): Promise<{ testCase: string, timeTaken: number }> {
    const repo = new ElasticUserActionsRepository(config, logger);
    log(`Starting case: ${testCase}`)
    const start = performance.now();
    const baseQuery = ESQueryBuilder.baseQuery("useractions", query, { maxResults: 9999 })
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await repo.runQuery(baseQuery, async () => { })
    const end = performance.now();
    const timeTaken = end - start;
    return {
        testCase,
        timeTaken
    }
}

async function getUserActionOneYearBack(accountId: string) {
    const date = subYears(new Date(), 1).toISOString()
    const query = {
        bool: {
            must: [
                {
                    term: {
                        accountId
                    }
                },
                {
                    range: {
                        start: {
                            gte: date
                        }
                    }
                },
            ]
        }
    }
    return await runTestCase(`Get all user actions from account ${accountId} from last year`, query)
}

async function getUserActionEditInLastSixMonths(accountId) {
    const date = subMonths(new Date(), 6).toISOString()
    const query = {
        bool: {
            must: [
                {
                    term: {
                        accountId
                    }
                },
                {
                    range: {
                        start: {
                            gte: date
                        }
                    }
                },
                {
                    terms: {
                        userActionType: [
                            403
                        ]
                    }
                }
            ]
        }
    }
    return await runTestCase(`Get all edit user actions from account ${accountId} from last six months`, query)
}

async function getUserActionReadsInLastThreeYears(accountId: string) {
    const date = subYears(new Date(), 3).toISOString()
    const query = {
        bool: {
            must: [
                {
                    term: {
                        accountId
                    }
                },
                {
                    range: {
                        start: {
                            gte: date
                        }
                    }
                },
                {
                    terms: {
                        userActionType: [
                            10
                        ]
                    }
                }
            ]
        }
    }
    return await runTestCase(`Get all read user actions from account ${accountId} from last three year`, query)
}

async function getUserActionByUserIdInLastTwoYear(accountId: string, userId: string) {
    const date = subYears(new Date(), 2).toISOString()
    const query = {
        bool: {
            must: [
                {
                    term: {
                        accountId
                    }
                },
                {
                    range: {
                        start: {
                            gte: date
                        }
                    }
                },
                {
                    terms: {
                        userId: [
                            userId
                        ]
                    }
                }

            ]
        }
    }
    return await runTestCase(`Get all user actions from  account ${accountId} for user ${userId} from last two year`, query)
}

main(async () => {
    const { accountId, userId } = getOptions()
    const results = []
    results.push(await getUserActionOneYearBack(accountId))
    results.push(await getUserActionEditInLastSixMonths(accountId))
    results.push(await getUserActionReadsInLastThreeYears(accountId))
    results.push(await getUserActionByUserIdInLastTwoYear(accountId, userId))
    log("Results:")
    for(const { testCase, timeTaken} of results) {
        log((`Done: "${testCase}"`));
        log((`Took ${timeTaken.toFixed(2)} ms`));
        log("=================================")
    }
})

type ScriptOptions = {
    accountId: string
    userId: string
}

function getOptions(): { accountId: string, userId: string } {
    const program = new Command()
    program
        .name(SCRIPT_NAME)
        .description("The goal of this script is to merge user action indices")
        .version("0.1.1")
        .option("-a, --account-id <string>", "Account id on which test will be run", "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6") //demo.manual.to
        .option("-u, --user-id <string>", "User id on that will be used on test queries", "uid-bc69a0fa-cf0d-43a9-992e-96ece892b324") // Jorim user
    program.parse(process.argv)
    return program.opts() as ScriptOptions
}