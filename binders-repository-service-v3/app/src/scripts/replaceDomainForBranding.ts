import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { info, panic } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ReaderBrandingRepositoryFactory } from "../routingservice/repositories/readerbranding";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "Replace domain for branding";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible for replacing domain filed on reader braning entity")
    .option("-d, --dry", "if set, do not replace domain")
    .option("--oldDomain <oldDomain>", "The domain that need to be replaced in reader branding entities")
    .option("--newDomain <newDomain>", "The new domain for reader branding entities")


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
    const logger = LoggerBuilder.fromConfig(config, "replace-domain-for-branding");
    const loginOption = getMongoLogin("routing_service")
    const semanticLinkCollectionConfig = await CollectionConfig.promiseFromConfig(config, "readerbranding", loginOption)
    const factory = new ReaderBrandingRepositoryFactory(semanticLinkCollectionConfig, logger)
    const readerBrandingRepository = factory.build(logger)


    const branding = await readerBrandingRepository.getReaderBranding(options.oldDomain)

    if (!options.dry) {
        info(`Starting update of branding for domain ${options.oldDomain} into ${options.newDomain}`)
        await readerBrandingRepository.updateReaderBranding(branding.id, { ...branding, domain: options.newDomain })
        info(`Updated branding ${branding.id}`)
    }

})