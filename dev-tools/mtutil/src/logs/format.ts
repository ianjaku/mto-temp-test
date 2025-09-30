import { AnyLog, Category } from "./types";
import { format, parseISO } from "date-fns";
import { formatJson, indent, stripAnsiCodes } from "../utils";
import { last, pluck } from "ramda";
import chalk from "chalk";

enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5
}

const {
    bgRed,
    black: fgBlack,
    bold,
    blue: fgBlue,
    gray: fgDimmed,
    green: fgGreen,
    red: fgRed,
    underline,
    yellow: fgYellow,
    white: fgWhite,
} = chalk;
chalk.level = 1

export enum LogDetail {
    Default,
    Verbose,
}

export function formatLine(rawLine: string, detail?: LogDetail): string[] {
    const line = rawLine.startsWith("[SERVICE]") ? rawLine.slice(10) : rawLine;
    const item = JSON.parse(line) as Record<string, string>;
    const category = asCategory(item.category);
    if (!category) {
        return [bold(bgRed(fgBlack(`Unknown category: ${bold(item.category)}`))), fgDimmed(rawLine)]
    }

    const time = item.time && format(parseISO(item.time), "HH:MM:ss")
    const level = Math.round(parseInt(item.level) / 10) - 1
    const timeBox = time && time.length ? [fgDimmed(time)] : []
    const levelBox = [levelToIcon(level)]

    const lines = [
        [
            ...levelBox,
            underline(category),
            ...(item.msg ? [formatMessage(item.msg)] : []),
        ].join(" ")
    ]

    let categoryLines: string[] = [];

    switch (category) {
        case Category.Request:
        case Category.Domains:
            categoryLines = formatRequest(item);
            break
        case Category.MongoIndex:
            categoryLines = formatMongoIndex(item);
            break
        case Category.Cors:
            categoryLines = formatCors(item);
            break
        case Category.ContentV1:
        case Category.CreateBinder:
        case Category.ElasticInit:
        case Category.ElasticScroll:
        case Category.EsStats:
        case Category.GetLocalCopy:
        case Category.MongoConnect:
            categoryLines.push("");
            break
        case Category.Panic:
            categoryLines = formatPanic(item)
            break
        case Category.AzureBlobUpload:
        case Category.ImageApi:
        case Category.ImageUpload:
        case Category.ImageWorker:
        case Category.SharpHandler:
            categoryLines = [
                ...formatImage(category, rawLine, item),
                ...formatShared(item),
            ]
            break
        case Category.RedisGetSet:
        case Category.RedisPubsub:
        case Category.RedisLocking:
            categoryLines = formatShared(item)
            break
        case Category.UsageAzureOpenAi:
            categoryLines.push(JSON.stringify(item.data));
            break
        default:
            categoryLines.push(fgDimmed(rawLine))
    }

    if (detail === LogDetail.Verbose) {
        categoryLines.push(fgDimmed(rawLine))
    }
    categoryLines = categoryLines.map(line => indent(line, 10));
    categoryLines[0] = timeBox.join() + categoryLines[0].slice(8);
    return [
        ...lines,
        ...categoryLines,
        "",
    ]
}

function formatMessage(message: string | Record<string, unknown>): string {
    return typeof message === "string" ? message : JSON.stringify(message, null, 2);
}

function asCategory(anystr: string): Category | null {
    return Object.values(Category).includes(anystr as Category) ? anystr as Category : null;
}

function formatCors(anylog: AnyLog): string[] {
    return [
        ` ${bold("CORS")} ${anylog.data.url}`
    ]
}

function formatImage(category: Category, rawLine: string, anylog: AnyLog): string[] {
    switch (category) {
        case Category.AzureBlobUpload:
        case Category.ImageApi:
        case Category.ImageUpload:
        case Category.ImageWorker:
            return []
        case Category.SharpHandler:
            return [[
                fgDimmed(bold("Data:")),
                fgDimmed(stripAnsiCodes(formatJson(anylog.data))),
            ].join(" ")]
    }
    return []
}

interface MongoIndex {
    name: string;
}

function formatMongoIndex(msg: AnyLog): string[] {
    return [
        [
            [bold("Mongo Indexes:"), pluck("name", msg.data.mongoIndexes as MongoIndex[]).join(" ")].join(" "),
            [bold("Schema Indexes:"), pluck("name", msg.data.schemaIndexes.map(last) as MongoIndex[]).join(" ")].join(" "),
            [bold("toCreate:"), msg.data.diff.toCreate.length].join(" "),
            [bold("toDrop:"), msg.data.diff.toDrop.length].join(" "),
        ].join(", "),
    ].map(line => fgDimmed(line))
}

function formatPanic(msg: AnyLog): string[] {
    if (typeof (msg.msg) === "string") {
        return [
            [bgRed(fgBlack(" PANIC ")), bold(fgRed(msg.msg))].join(" "),
        ]
    }
    return [
        [bgRed(fgBlack(" PANIC ")), bold(fgRed(msg.msg.name))].join(" "),
        ...(msg.msg.stack ?? "").split("\n").map(line => fgRed(line))
    ]
}

function formatRequest(msg: AnyLog): string[] {
    if (msg.requestVerb) {
        const duration = msg.data?.timings?.duration ? [`${fgYellow(msg.data?.timings?.duration)}ms`] : []
        const status = msg.data?.status ?? "500";
        const statusBox = [
            +status < 300 ?
                bold(fgGreen(status)) :
                bold(fgRed(status))
        ]
        const formatFn = +status < 300 ? x => x : fgRed
        return [
            [...statusBox, bold(msg.requestVerb), bold(formatFn(msg.data?.url ?? msg.requestPath)), ...duration].join(" "),
            ...formatShared(msg),
        ]
    }
    return [
        [bold(msg.data?.method), msg.data?.url].join(" ")
    ]
}

function formatShared(msg: AnyLog, detail?: LogDetail): string[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null
    if (typeof msg.data === "string") {
        try {
            data = JSON.parse(msg.data)
        } catch (e) {
            data = null
        }
    } else {
        data = msg.data
    }
    const errorStack = data?.stack?.split("\n") ?? []
    const errorBox = data?.stack ?
        [
            ...(data?.name ? [fgRed(["Name:        ", bold(data?.name)].join(" "))] : []),
            ...(data?.message ? [fgRed(["Message:     ", bold(data?.message)].join(" "))] : []),
            ...(data?.msg ? [fgRed(["Msg:         ", bold(data?.msg)].join(" "))] : []),
            fgRed(["Stacktrace:  ", bold(errorStack[0])].join(" ")),
            ...errorStack.slice(1).map(fgRed),
        ] :
        [];
    return [
        fgDimmed(["Endpoint:       ", bold(msg.requestPath)].join(" ")),
        fgDimmed(["Requested By:   ", bold(msg.requestedBy)].join(" ")),
        fgDimmed(["Correlation Key:", bold(msg.correlationKey)].join(" ")),
        fgDimmed(["Domain:         ", bold(msg.domain)].join(" ")),
        ...errorBox,
        ...(detail === LogDetail.Verbose ?
            [fgDimmed(["     ", "Data:", stripAnsiCodes(formatJson(msg.data))].join(" "))] :
            []),
    ]
}

export function levelToIcon(level: LogLevel): string {
    switch (level) {
        case LogLevel.TRACE:
            return bold("  TRACE ")
        case LogLevel.DEBUG:
            return bold(fgWhite("  DEBUG "))
        case LogLevel.INFO:
            return bold(fgBlue("  INFO  "))
        case LogLevel.WARN:
            return bold(fgYellow("  WARN  "))
        case LogLevel.ERROR:
            return bold(fgRed("  ERROR "))
        case LogLevel.FATAL:
            return bold(fgRed("  FATAL "))
    }
}
