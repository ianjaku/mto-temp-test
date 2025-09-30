import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { info, panic } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { SemanticLinkRepositoryFactory } from "../routingservice/repositories/semanticlink";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "Replace domain for sematic links";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible for replacing domain property on semantic link entities")
    .option("-d, --dry", "if set, do not replace domain")
    .option("--oldDomain <oldDomain>", "The domain that need to be replaced in semantic links entities")
    .option("--newDomain <newDomain>", "The new domain for given sematic link entities")


program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    dry?: boolean;
    oldDomain?: string;
    newDomain?: string;

};
main(async () => {
    if (!options.oldDomain) {
        panic("Please provide parameter --oldDomain <some-domain>")
    }

    if (!options.newDomain) {
        panic("Please provide parameter --newDomain <some-domain>")
    }

    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "replace-domain-for-sematic-links");
    const loginOption = getMongoLogin("routing_service")
    const semanticLinkCollectionConfig = await CollectionConfig.promiseFromConfig(config, "semanticlink", loginOption)
    const factory = new SemanticLinkRepositoryFactory(semanticLinkCollectionConfig, logger)
    const semanticLinkRepository = factory.build(logger)


    info(`Checking how many links with domain ${options.oldDomain} exists in db`)
    const affectedLinks = await semanticLinkRepository.findSemanticLinks({ domain: options.oldDomain })
    info(`There are ${affectedLinks.length} semtantic links with old domain.`)

    if (!options.dry) {
        info("Starting update of old semantic links")
        const { updateCount, matchCount } =await semanticLinkRepository.replaceDomainInSemanticLinks(options.oldDomain, options.newDomain)
        info(`Matched ${matchCount} links. Updated ${updateCount}.`)
    }

})