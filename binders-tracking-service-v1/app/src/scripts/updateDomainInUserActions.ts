/* eslint-disable no-console */
import {
    IUserAccessedUrlData,
    IUserAction
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { info, panic } from "@binders/client/lib/util/cli";
import {
    updateDomainInUrlData,
    urlDataNeedsDomainUpdate
} from "../trackingservice/domainConverter";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const SCRIPT_NAME = "Replace domain for sematic links";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible updating domain in IUserAccessedUrlData user actions")
    .option("-d, --dry", "if set, do not replace domain")
    .option("--accountId <accountId>, Account on which we would like to update domain ")
    .option("--oldDomain <oldDomain>", "The domain that need to be replaced in user actions")
    .option("--newDomain <newDomain>", "The new domain that should replace old one in user actions")


program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    accountId?: string;
    dry?: boolean;
    oldDomain?: string;
    newDomain?: string;
};

async function updateAll(repo: ElasticUserActionsRepository, userActionsToUpdate: IUserAction<IUserAccessedUrlData>[]) {
    if (!userActionsToUpdate.length) {
        info("No IUserAccessedUrlData user actions found.")
        return;
    }
    info(`updating ${userActionsToUpdate.length} IUserAccessedUrlData user actions, eg ${JSON.stringify(userActionsToUpdate[0], null, 2)}`);
    if (userActionsToUpdate.length > 0) {
        await repo.multiUpdateUserAction(userActionsToUpdate);
    }
}



function buildQueries(accountId: string) {
    return {
        userActionsQuery: {
            index: "useractions",
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { accountId: accountId } },
                            { term: { userActionType: 701 } }
                        ]
                    }
                }
            },
            size: 9999
        },
    }
}


const doIt = async () => {
    if (!options.accountId) {
        panic("Please provide parameter --accountId <accound-id>")
    }


    if (!options.oldDomain) {
        panic("Please provide parameter --oldDomain <some-domain>")
    }

    if (!options.newDomain) {
        panic("Please provide parameter --newDomain <some-domain>")
    }

    if (options.oldDomain.includes("manual.to")) {
        panic(`--oldDomain ${options.oldDomain} parameter shouldn't contain manual.to domain. Use --oldDomain ${options.oldDomain.replace(".manual.to", "")} instead`)
    }

    if (options.newDomain.includes("manual.to")) {
        panic(`--newDomain ${options.newDomain} parameter shouldn't contain manual.to domain. Use --newDomain ${options.newDomain.replace(".manual.to", "")} instead`)
    }

    const { accountId, dry, oldDomain, newDomain } = options
    const repo = new ElasticUserActionsRepository(config, logger);
    const { userActionsQuery } = buildQueries(accountId);
    const userActionsToCheck = await repo.runQuery<IUserAction<IUserAccessedUrlData>[]>(userActionsQuery, (source) => {
        return source.hits.hits.map(hit => ({ ...hit._source, id: hit._id, index: hit._index }))
    })
    info(`There are ${userActionsToCheck.length} IUserAccessedUrlData user actions for account ${accountId}`)
    const userActionsToUpdate: IUserAction<IUserAccessedUrlData>[] = []
    for (const userAction of userActionsToCheck) {
        if (urlDataNeedsDomainUpdate(userAction.data, oldDomain)) {
            const data = updateDomainInUrlData(userAction.data, oldDomain, newDomain)
            userActionsToUpdate.push({ ...userAction, data })
        }
    }
    info(`${userActionsToUpdate.length} IUserAccessedUrlData user actions requries domain update ${oldDomain} --> ${newDomain}`)
    if (!dry) {
        await updateAll(repo, userActionsToUpdate);
    }
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    }, error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });