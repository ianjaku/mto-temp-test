/* eslint-disable no-console */
import * as chalk from "chalk";
import * as readline from "readline";
import { BackendAccountServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BackendRoutingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BinderOrDocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import { getBinderMasterLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { inspect } from "util";
import { isDocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { panic } from "@binders/client/lib/util/cli";
import { readFileSync } from "fs";

const { bold, gray: fgDimmed, green: fgGreen, red: fgRed, yellow: fgYellow } = chalk;

const NEWLINE = "\n";
const DEFAULT_DOMAIN = "demo.manual.to";

const SCRIPT_NAME = "getBinderLinks";

type ScriptOptions = {
    binderIds?: string;
    color?: boolean;
    env?: string;
    file?: string;
    namespace?: string;
    stdin?: boolean;
    quiet?: boolean;
};

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Get links to binders from binderIds")
    .option("--binderIds [binderId...]", "Comma-separated list of binderIds")
    .option("--file [path]", "Path to a file containing binderIds on each line")
    .option("--namespace [namespace]", "Required if env == staging")
    .option("--stdin", "Read the binderIds from stdin")
    .option("--env [env]", "One of dev, staging, prod. Default: dev")
    .option("--no-color", "If set, will not output colors (handled automatically by chalk)")
    .option("-q, --quiet", "If set, will not print debugging info");

program.parse(process.argv);
const options: ScriptOptions = program.opts();

async function doIt() {
    if (!options.quiet) {
        debugVar("options", options);
    }

    const env = options.env ?? "dev";
    if (env === "staging" && !options.namespace) {
        panic("For staging environment, pass the namespace with --namespace");
    }

    if (!options.file && !options.stdin && !options.binderIds) {
        panic("Either --binderIds, --file, or --stdin must be specified");
    }

    let binderIds: string[] = [];
    if (options.binderIds?.length) {
        log("==> Using binderIds passed in command option");
        binderIds = options.binderIds.split(",");
    } else {
        if (options.file) {
            log(`==> Loading from file ${options.file}`);
            binderIds = readFileSync(options.file).toString().split(NEWLINE);
        } else if (options.stdin) {
            log("==> Reading from stdin");
            binderIds = (await readStdin()).split(NEWLINE);
        }
    }

    if (!options.quiet) {
        debugVar("binderIds", binderIds);
    }

    const binders = await findBinders(binderIds);
    let accounts = new Map<string, Account>();

    for (const binderId of binderIds) {
        log(`===> Binder ID: ${binderId}`);
        const binder = binders.get(binderId);
        if (!binder) {
            err(`Binder ${binderId} not found`);
            continue;
        }
        if (!binder.accountId) {
            err(`Binder ${binderId} doesn't have accountId`);
            continue;
        }
        const account = accounts.get(binder.accountId) ?? await findAccount(binder.accountId);
        accounts = accounts.set(binder.accountId, account);
        let domain = account.domains.at(0);
        const pub = await findActivePublication(binderId ?? "Unknown");
        let path = "";
        let url: string | undefined;
        if (!domain) {
            domain = DEFAULT_DOMAIN;
            warn(`Domain for account ${binder.accountId} not found. defaulting to ${domain}`);
        }
        let readerDomain: string;
        let urlParams = "";
        if (env === "dev") {
            readerDomain = "http://localhost:30014";
            urlParams = `?domain=${domain}`;
        } else if (env === "staging") {
            readerDomain = `https://manualto-${options.namespace}.staging.binders.media`;
            urlParams = `?domain=${domain}`;
        } else {
            readerDomain = domain;
        }
        if (!pub) {
            warn(`Could not find publication for binder ${binderId}`);
            path = `preview/${binderId}`;
            console.log(`${readerDomain}/${path}${urlParams}`);
        } else {
            url = await createReaderLink(binder, {
                domain,
                readerDomain,
            });
            console.log(url);
        }
        process.stderr.write(NEWLINE);
    }
}

async function createReaderLink(
    item: BinderOrDocumentCollection,
    options: {
        domain: string;
        readerDomain: string;
    },
): Promise<string | undefined> {
    const config = BindersConfig.get();

    const readerLocation = getReaderLocation(options.domain, options.readerDomain);
    const routingClient = await BackendRoutingServiceClient.fromConfig(config, SCRIPT_NAME);

    let lang: string;
    let semanticLinks: ISemanticLink[] = [];
    if (!item.id) {
        return undefined;
    }
    if (isDocumentCollection(item)) {
        lang = item.titles[0].languageCode 
    } else {
        lang = getBinderMasterLanguage(item).iso639_1;
        semanticLinks = await routingClient.findSemanticLinks(item.id)
    }

    return buildLink({
        domain: options.domain,
        isCollection: isDocumentCollection(item),
        lang,
        itemId: item.id,
        semanticLinks,
        readerLocation,
        fullPath: true,
        isPublication: false
    });
}

async function findAccount(accountId: string): Promise<Account> {
    const config = BindersConfig.get();
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const routingClient = await BackendRoutingServiceClient.fromConfig(config, SCRIPT_NAME);
    const [ domainFilter ] = await routingClient.getDomainFiltersForAccounts([accountId]);
    const { domain } = domainFilter ?? {};
    const account = await accountServiceClient.getAccount(accountId);
    account.domains[0] = domain;
    return account
}

async function findActivePublication(binderId: string) {
    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const pubs = await repoServiceClient.findPublicationsBackend(
        { binderId, isActive: 1 },
        { maxResults: 2000 }
    );
    if (pubs.length !== 1) {
        err(`Found ${pubs.length} active publications`);
        return null;
    }
    return pubs.at(0);
}

async function findBinders(binderIds: string[]): Promise<Map<string, BinderOrDocumentCollection>> {
    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const binders = await repoServiceClient.findItems(
        { binderIds },
        {
            maxResults: binderIds.length + 2,
            omitContentModules: true,
            includeViews: false,
        },
    )
    return new Map(binders.map(b => [b.id ?? "Unknown", b]));
}

async function readStdin(): Promise<string> {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        let inputData = "";
        rl.on("line", (line) => {
            inputData += line + "\n";
        });
        rl.on("close", () => {
            resolve(inputData);
        });
    })
}

const warn = (msg: string) => process.stderr.write(fgYellow(msg) + NEWLINE);
const err = (msg: string) => process.stderr.write(fgRed(msg) + NEWLINE);
const ok = (msg: string) => process.stderr.write(fgGreen(msg) + NEWLINE);
const log = (msg = "") => process.stderr.write(bold(msg) + NEWLINE);
const debug = (errorObject: unknown) => inspect(errorObject, { showHidden: false, depth: null, colors: false });
const debugVar = (name: string, value: unknown) => process.stderr.write(fgDimmed(`${name} = `) + bold(fgDimmed(debug(value))) + NEWLINE);


doIt()
    .then(() => ok("Done"))
    .catch(ex => err(inspect(ex)))
