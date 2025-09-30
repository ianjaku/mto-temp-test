import { log, main } from "@binders/binders-service-common/lib/util/process";
import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";

const config = BindersConfig.get();
const SCRIPTNAME = "bootstrapTrialEnv";

const program = new Command();

program
    .name(SCRIPTNAME)
    .description("Invokes the trial environment setup process to use as manual test")
    .option("-a, --accountId [accountId]", "accountId of the trial account")
    .option("-c, --companyName [name]", "Company name of the trial user")
    .option("-e, --email [email]", "Email of the trial account")
    .option("-f, --firstName [name]", "First name of the trial user")
    .option("-l, --lastName [name]", "Last name of the trial user")
    .option("-t, --templateCollectionId [templateCollectionId]", "collectionId of the template collection to be duplicated")

function getOptions() {
    program.parse(process.argv);
    const options = program.opts();
    const { accountId, firstName, lastName, companyName, email, templateCollectionId } = options;

    if (!accountId || !firstName || !lastName || !companyName || !email || !templateCollectionId) {
        throw new Error("All parameters are required");
    }
    return {
        accountId,
        companyName,
        email,
        firstName,
        lastName,
        templateCollectionId,
    };
}

main(async () => {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const {
        accountId: trialAccountId,
        companyName,
        email,
        firstName,
        lastName,
        templateCollectionId,
    } = getOptions();
    await accountServiceClient.bootstrapTrialEnvironment({
        trialAccountId,
        templateCollectionId,
        firstName,
        lastName,
        companyName,
        login: email,
    });
    log("Trial environment setup completed");
});
