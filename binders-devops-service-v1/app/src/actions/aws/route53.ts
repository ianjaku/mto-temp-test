import { AddressFamily, lookup } from "../dns/lookup";
import { dumpJSON, loadJSON } from "../../lib/json";
import { sequential, sleep } from "../../lib/promises";
import { buildAndRunCommand } from "../../lib/commands";
import { dumpFile } from "../../lib/fs";
import { log } from "../../lib/logging";

export interface RecordSet {
    Name: string,
    Type: DNSRecordType,
    TTL: number,
    AliasTarget?: unknown,
    ResourceRecords?: { Value: string }[]
}

type Action = "UPSERT"

export interface RecordSetChange {
    Action: Action,
    ResourceRecordSet: RecordSet
}

export interface HostedZoneRecordsChange {
    Comment: string
    Changes: RecordSetChange[]
}

export interface ResourceRecordSets {
    ResourceRecordSets: RecordSet[]
}

export interface ChangeInfo {
    Id: string
    Status: string
}

export interface GetChangeResponse {
    ChangeInfo: ChangeInfo
}

export type DNSRecordType = "A" | "CNAME"

const runAwsRoute53 = async (args: string[]) => {
    const { output } = await buildAndRunCommand(
        () => ({
            command: "aws",
            args: ["route53", ...args],

        }),
        { mute: true }
    );
    return JSON.parse(output);
};

export const getZoneIds = async (): Promise<{ [domain: string]: string }> => {
    const zoneInfo = await runAwsRoute53(["list-hosted-zones"]);
    const hostedZones = zoneInfo["HostedZones"];
    const extractZoneId = zoneIdStr => {
        const matches = zoneIdStr.match(/^\/hostedzone\/(.*)/);
        return matches && matches[1];
    };
    return hostedZones.reduce(
        (reduced, zone) => ({ ...reduced, [zone.Name]: extractZoneId(zone.Id) }),
        {}
    );
};

export const listRecordsSets = async (hostedZoneId: string): Promise<ResourceRecordSets> => {
    return runAwsRoute53(["list-resource-record-sets", "--hosted-zone-id", hostedZoneId]);
}

const getChange = async (id: string): Promise<GetChangeResponse> => {
    return runAwsRoute53(["get-change", "--id", id]);
}

export const waitForDnsPropagation = async (changeId: string): Promise<void> => {
    log(`Checking dns propagation status for hosted zone ${changeId}`)
    const { ChangeInfo } = await getChange(changeId)
    if (ChangeInfo.Status === "PENDING") {
        log(`Status ${ChangeInfo.Status}, wait 5000ms...`)
        await sleep(5000)
        await waitForDnsPropagation(changeId)
        return;
    }
    log(`Got change with status: ${ChangeInfo.Status}`)
}

export const updateRecords = async (hostedZoneId: string, path: string): Promise<GetChangeResponse> => {
    const filePath = "file://" + path
    return runAwsRoute53(["change-resource-record-sets", "--hosted-zone-id", hostedZoneId, "--change-batch", filePath]);
}

export const createRecordChange = (value: string, type: DNSRecordType) => (record: RecordSet): RecordSetChange => {
    return {
        Action: "UPSERT",
        ResourceRecordSet: {
            Name: record.Name,
            Type: type,
            TTL:  record.TTL,
            ResourceRecords: [
                {
                    Value: value
                }
            ]
        }
    }
}

export const createHostedZoneRecordSetChange = (changes: RecordSetChange[]): HostedZoneRecordsChange => {
    return {
        Comment: "Update record to reflect new IP address for a system",
        Changes: changes
    }
}

export const filterRecordsByValue = (records: ResourceRecordSets, value: string): RecordSet[] => {
    return records.ResourceRecordSets
        .filter(r => r.ResourceRecords)
        .filter(record => {
            if (record.ResourceRecords.length > 0) {
                const filteredRecords = record.ResourceRecords.filter(v => v.Value === value)
                return filteredRecords.length > 0
            }
            return false
        })
}

export const dumpRecordSets = async (domain: string, zoneId: string): Promise<string> => {
    const recordSets = await getChange(zoneId)
    const jsonFile = `/tmp/route53-routes-${domain}.json`;
    await dumpJSON(recordSets, jsonFile);
    return jsonFile;
};

interface ZoneFileLine {
    name: string;
    ttl: number;
    type: string;
    value: string;
    comment: string;
}

const toZoneFileLines = async (recordSet): Promise<ZoneFileLine[]> => {
    const name = recordSet.Name.replace("\\052", "*");
    if ("AliasTarget" in recordSet) {
        const target = recordSet.AliasTarget.DNSName;
        const family = recordSet.Type === "AAAA" ? AddressFamily.IPV6 : AddressFamily.IPV4;
        const value = await lookup(target, family);
        return [{
            name,
            ttl: 60,
            type: recordSet.Type,
            value,
            comment: "Alias from AWS"
        }];
    }
    if ("ResourceRecords" in recordSet) {
        return recordSet.ResourceRecords.map(rec => {
            const value = rec.Value;
            return {
                name,
                ttl: recordSet.TTL,
                type: recordSet.Type,
                value
            };
        });
    }
    // eslint-disable-next-line no-console
    console.error(recordSet);
    throw new Error("I have no clue what to do :(");
};

const pullSOAForward = (lines: ZoneFileLine[]): ZoneFileLine[] => {
    return lines.reduce(
        (reduced, line) => {
            if (line.type === "SOA") {
                return [line, ...reduced];
            }
            return [...reduced, line];
        },
        []
    );
};

const printZoneFileLine = (line: ZoneFileLine): string => {
    return [line.name, line.ttl, "IN", line.type, line.value, line.comment ? `; ${line.comment}` : undefined]
        .filter(l => !!l)
        .join("\t");
};

export const jsonToZoneFile = async (jsonFileName: string): Promise<string> => {
    const data = await loadJSON(jsonFileName);
    if (data["isTruncated"]) {
        throw new Error("Paging not yet implemented");
    }
    const recordSets = data["ResourceRecordSets"];
    let zoneFileLines = [];
    await sequential(async recordSet => {
        const newLines = await toZoneFileLines(recordSet);
        zoneFileLines = [...zoneFileLines, ...newLines];
    }, recordSets);
    const orderedZoneFilesLines = pullSOAForward(zoneFileLines);
    const zoneFileNameCandidate = jsonFileName.replace(/\.json$/, ".zone");
    const zoneFileName = zoneFileNameCandidate !== jsonFileName ?
        zoneFileNameCandidate :
        `${jsonFileName}.zone`;
    const zoneFileContents = orderedZoneFilesLines
        .map(printZoneFileLine)
        .join("\n");
    await dumpFile(zoneFileName, zoneFileContents);
    return zoneFileName;
};