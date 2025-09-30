import { HTTPVerb } from "@binders/client/lib/clients/routes";
import { loadFile } from "../../lib/fs";
import log from "../../lib/logging";
import moment from "moment";

export interface ILogEntry {
    clientIp: string;
    date: Date;
    verb: HTTPVerb;
    path: string;
    statusCode: number;
    requestDurationInMs: number;
    upstreamName: string;
    upstreamAddress: string;
}


const LINE_PATTERNS = [
    /(?<clientIp>[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) - - \[(?<timestamp>[^\]]+)\] "(?<verbAndPath>[^"]+)" (?<statusCode>[0-9]+) (?<responseLength>[^ ]+) "(?<referer>[^"]+)" "(?<userAgent>[^"]+)" (?<requestLength>[0-9]+) (?<requestDuration>[0-9.]+) \[(?<upstreamName>[^\]]+)\] (?<upstreamAddress>[^ ]+)/,
    /(?<clientIp>[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) - [^-].* - [^ ]+ \[(?<timestamp>[^\]]+)\] "(?<verbAndPath>[^"]+)" (?<statusCode>[0-9]+) (?<responseLength>[^ ]+) "(?<referer>[^"]+)" "(?<userAgent>[^"]+)" (?<requestLength>[0-9]+) (?<requestDuration>[0-9.]+) \[(?<upstreamName>[^\]]+)\] (?<upstreamAddress>[^ ]+)/,
];

export interface IParseOptions {
    verbose?: boolean;
}

export async function parseLog(path: string, options: IParseOptions = {}): Promise<ILogEntry[]> {
    const fileContents = await loadFile(path);
    const lines = fileContents.split("\n");
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const entry = parseLine(lines[i]);
        if (entry === undefined) {
            if (options.verbose) {
                log(`Could not parse line: ${lines[i]}`);
            }
        } else {
            results.push(entry);
        }
    }
    return results;
}

export function parseLine(line: string): ILogEntry | undefined {
    for (const LINE_PATTERN of LINE_PATTERNS) {
        const match = LINE_PATTERN.exec(line);
        if (!match || !match.groups) {
            continue;
        }
        const {
            clientIp,
            verbAndPath,
            statusCode,
            timestamp,
            requestDuration,
            upstreamName,
            upstreamAddress
        } = match.groups;
        const [ verb, path ] = verbAndPath.split(" ");
        return {
            clientIp,
            verb,
            path,
            statusCode: Number.parseInt(statusCode, 10),
            date: moment(timestamp, "DD/MMM/YYYY:HH:mm:ss Z").toDate(),
            requestDurationInMs: Number.parseFloat(requestDuration) * 1000,
            upstreamName,
            upstreamAddress
        }
    }
    return undefined;
}