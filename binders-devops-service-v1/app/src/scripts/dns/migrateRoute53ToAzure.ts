import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { dumpRecordSets, getZoneIds, jsonToZoneFile } from "../../actions/aws/route53";
import { importZoneFile } from "../../actions/azure/dns";
import log from "../../lib/logging";
import { main } from "../../lib/program";

interface IDNSMigrateOptions {
    azureResourceGroup: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        azureResourceGroup: {
            long: "azure-resource-group",
            short: "g",
            description: "The azure resource group hosting the DNS zone",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("migrateRoute53ToAzure", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as IDNSMigrateOptions;
};

const migrateDomain = async (domain: string, zoneId: string, resourceGroup: string) => {
    log("- Fetching record sets");
    const jsonFile = await dumpRecordSets(domain, zoneId);
    log("- Converting to zone file");
    const zoneFile = await jsonToZoneFile(jsonFile);
    log("- Import zone file in Azure DNS");
    await importZoneFile(resourceGroup, domain, zoneFile);
};

const doIt = async () => {
    const { azureResourceGroup } = getOptions();
    log("Fetching zone ids from AWS");
    const zoneIds = await getZoneIds();
    for (const domain in zoneIds) {
        log(`Start migration of ${domain}`);
        await migrateDomain(domain, zoneIds[domain], azureResourceGroup);
    }
};

main(doIt);