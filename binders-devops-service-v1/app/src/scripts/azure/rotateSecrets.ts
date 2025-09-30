import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { main } from "../../lib/program";
import { rotateSecrets } from "../../actions/azure/appSecrets";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        id: {
            long: "id",
            short: "i",
            description: "Desired azure application object id to make rotation of secrets",
            kind: OptionType.STRING,
        },
        dryRun: {
            long: "dryRun",
            kind: OptionType.BOOLEAN,
            description: "Only perform a dry run, don't change anything",
            default: false
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const doIt = async () => {
    const { dryRun, id } = getOptions();
    const config = BindersConfig.get();

    const allSecretsValid = await rotateSecrets(config, dryRun, id)
    if(!allSecretsValid) {
        throw new Error("Not all app has valid secrets!")
    }
}

main(doIt)