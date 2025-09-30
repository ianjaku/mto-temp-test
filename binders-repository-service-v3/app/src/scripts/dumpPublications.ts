/* eslint-disable no-console */
import {
    BackendRepoServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { writeFileSync } from "fs";

const getOptions = () => {
    const accountId = process.argv[2];
    if (!accountId) {
        console.error("Please provide an accountId.");
        process.exit(1);
    }
    return {
        accountId
    }
}

const doIt = async () => {
    const { accountId } = getOptions();
    
    const config = BindersConfig.get();
    const client = await BackendRepoServiceClient.fromConfig(config, "dump-publications");
    const result = await client.summarizePublicationsForAccount(accountId, "csv");
    writeFileSync(`/tmp/publications-${accountId}.csv`, result);
}

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )