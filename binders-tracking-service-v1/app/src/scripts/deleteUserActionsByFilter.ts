/* eslint-disable no-console */
import * as readline from "readline";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import {
    ElasticUserActionsRepository
} from "../trackingservice/repositories/userActionsRepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MAX_RESULTS } from "../trackingservice/config";

const getOptions = () => {
    const { argv } = process;
    const hasOptions = argv.length > 2;
    if (!hasOptions) {
        console.log("Error: provide stringified filter as param");
        process.exit(1);
    }
    let filter;
    try {
        filter = JSON.parse(argv[2]);
    }
    catch (e) {
        console.log("Error: provide stringified query as param");
        process.exit(1);
    }
    return {
        filter,
    };
};

function getUserActionsRepo() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "delete-useractions");
    return new ElasticUserActionsRepository(config, logger);
}

async function confirm(affectedCount: number): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(`This will delete ${affectedCount} useractions. Are you sure you want to continue? y/n: `, function (answer) {
            resolve(answer === "y");
        });
    });
}

(async function () {

    const { filter } = getOptions();

    const userActionsRepo = getUserActionsRepo();

    const affected = await userActionsRepo.find(filter);
    if (!(await confirm(affected.length))) {
        console.log("Aborted");
        process.exit(0);
    }
    const deletedCount = await userActionsRepo.deleteUserActionsByFilter(filter);
    console.log(`All done! ${deletedCount} user actions deleted`);
    if (deletedCount === MAX_RESULTS) {
        console.log("Warning: max results reached. There may be more useractions to delete");
    }
    process.exit(0);
})();
