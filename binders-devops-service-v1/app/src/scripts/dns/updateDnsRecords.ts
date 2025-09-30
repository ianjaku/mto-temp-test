import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    DNSRecordType,
    createHostedZoneRecordSetChange,
    createRecordChange,
    filterRecordsByValue,
    getZoneIds,
    listRecordsSets,
    updateRecords,
    waitForDnsPropagation,
} from "../../actions/aws/route53";
import { dumpJSON } from "../../lib/json";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";


const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        oldValue: {
            long: "oldValue",
            description: "The old value in DNS that should be replaced",
            kind: OptionType.STRING,
            required: true
        },
        newValue: {
            long: "newValue",
            description: "New value that should be insterted into records",
            kind: OptionType.STRING,
            required: true
        },
        oldDnsRecordType: {
            long: "oldDnsRecordType",
            description: "Type of the DNS record for oldValue",
            kind: OptionType.STRING,
            required: true
        },
        newDnsRecordType: {
            long: "newDnsRecordType",
            description: "Type of the DNS record for newValue (It's needed e.g when record should be changed from A record to CNAME",
            kind: OptionType.STRING,
            required: true
        },
        dryRun: {
            long: "dryRun",
            description: "Dry run mode",
            kind: OptionType.BOOLEAN,
            default: false
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any>parser.parse());
    return options;
};


interface ProcessHostedZoneConfig {
    id: string,
    dryRun: boolean,
    domain?: string
    oldValue: string
    newValue: string
    oldDNSRecordType: DNSRecordType
    newDNSRecordType: DNSRecordType
}

const processHostedZone = async (config: ProcessHostedZoneConfig) => {
    const { domain, dryRun, id, oldValue, newValue, newDNSRecordType, oldDNSRecordType } = config
    log(`Processing hosted zone id: ${id}, domain ${domain}`)
    const recordsSets = await listRecordsSets(id)
    const conflictingRecords = filterRecordsByValue(recordsSets, oldValue)


    const changes = []
    if (oldDNSRecordType !== newDNSRecordType && conflictingRecords.length > 0) {
        const deleteChanges = conflictingRecords.map(record => ({
            Action: "DELETE",
            ResourceRecordSet: record
        }));
        changes.push(...deleteChanges)
    }
    const upsertChanges = conflictingRecords.map(createRecordChange(newValue, newDNSRecordType))
    changes.push(...upsertChanges)
    if (changes.length > 0) {
        log(`We need to update ${changes.length} records`)
        const hostedZoneChange = createHostedZoneRecordSetChange(changes)
        log(JSON.stringify(hostedZoneChange))
        const filePath = `/tmp/hosted-zone-${id}-change.json`
        await dumpJSON(hostedZoneChange, filePath)
        if (!dryRun) {
            log(`Starting dns batch update process for hosted zone ${id}`)
            const { ChangeInfo } = await updateRecords(id, filePath)
            await waitForDnsPropagation(ChangeInfo.Id)
        }
    } else {
        log(`Nothing to update for hosted zone ${id} domain ${domain}`)
    }
}


const doIt = async () => {
    const { dryRun, newValue, oldValue, newDnsRecordType, oldDnsRecordType } = getOptions()

    const hostedZonesIds = await getZoneIds()
    for (const [domain, id] of Object.entries(hostedZonesIds)) {
        const config: ProcessHostedZoneConfig = {
            id,
            oldValue,
            newValue,
            oldDNSRecordType: oldDnsRecordType,
            newDNSRecordType: newDnsRecordType,
            dryRun,
            domain
        }
        await processHostedZone(config)
    }
}

main(doIt)