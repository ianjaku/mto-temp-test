import * as chalk from "chalk";
import { access, realpath, writeFile } from "fs/promises";
import { BINDERS_SERVICE_SPECS } from "../config/services";
import { Command } from "commander";
import { buildBindersDevConfig } from "../lib/bindersconfig";
import { buildDockerCompose } from "./docker-compose";
import { dumpYaml } from "../lib/yaml";
import findIp from "../lib/findIp";
import { getCurrentBranch } from "../actions/git/branches";
import { indexBy } from "ramda";
import loadConfig from "../lib/loadConfig";
import { log } from "./log";

const { bold, green, red, underline } = chalk;

const DC_VERSION = "0.1.6";

const program = new Command();
program
    .name("dc")
    .description("Generate docker-compose.yml file to run the cluster locally")
    .version(DC_VERSION)
    .option("--binders-config [path]", "Path to the binders config file on the host machine", "/tmp/local-dev-config.json")
    .option("-B, --build-and-run", "If set, run containers in build & run mode")
    .option("-D, --development", "If set, run containers in development mode (default)")
    .option("--domain [domain]", "Localhost domain", "binders.localhost")
    .option("--ip [ipv4]", "IP address to expose the cluster on")
    .option("-s, --production-secrets", "If set, fetch production binders config")
    .option("-r, --refetch-secrets", "If set, refetch binders config even when already downloaded")
    .option("--proxy", "Run in proxy mode")

async function doIt() {
    program.parse(process.argv);
    const options = program.opts() as {
        bindersConfig: string;
        buildAndRun: boolean;
        development: boolean;
        domain: string;
        ip: string;
        productionSecrets: boolean;
        proxy: boolean;
        refetchSecrets: boolean;
    };

    const configFilePath = await realpath(`${__dirname}/../../../src/scripts/localdev/devConfig.json`);
    log(`Loading devConfig from ${bold(configFilePath)}`);
    const devConfig = await loadConfig(configFilePath);
    const currentBranch = await getCurrentBranch();

    const ip = await findIp(devConfig);
    if (!ip) {
        log(red("Failed to resolve IP Address"));
        throw new Error("Could not resolve IP address");
    }

    const ipV4AddressesOverrides = {
        "account-v1": "172.0.30.101",
        "authorization-v1": "172.0.30.102",
        "binders-v3": "172.0.30.111",
        "comment-v1": "172.0.30.111",
        "content-v1": "172.0.30.111",
        "credential-v1": "172.0.30.104",
        "image-v1": "172.0.30.107",
        "notification-v1": "172.0.30.110",
        "public-api-v1": "172.0.30.117",
        "screenshot-v1": "172.0.30.120",
        "routing-v1": "172.0.30.111",
        "tracking-v1": "172.0.30.112",
        "user-v1": "172.0.30.113"
    }

    const formatBoolean = (value: boolean) => value ? "✔  Yes" : "✘  No";
    log();
    log(bold("==> devConfig"));
    log(`IP Address:         ${bold(ip)}`);
    log(`Current branch:     ${bold(currentBranch)}`)
    log(`Production secrets: ${formatBoolean(options.productionSecrets)}`)
    log(`Proxy:              ${formatBoolean(options.proxy)}`)
    log(`Web App Bundler:    ${bold(devConfig.webAppBundler)}`)
    log(`TS Compiler:        ${bold(devConfig.devTypeScriptCompiler)}`)
    log(`Mongo Location:     ${underline(devConfig.hostPathFolder)}`)
    log(`Elastic Location:   ${underline(devConfig.elasticPathPrefix)}`)

    const versionedServiceMap = indexBy(s => `${s.name}-${s.version}`, BINDERS_SERVICE_SPECS);

    log();
    log(bold("==> Fetching BindersConfig"));
    const bindersConfigSecretPath = options.bindersConfig;
    if (options.refetchSecrets || !await fileExists(bindersConfigSecretPath)) {
        const config = await buildBindersDevConfig(ip, options.proxy, currentBranch, options.productionSecrets);
        for (const [versionedServiceName, ipV4Address] of Object.entries(ipV4AddressesOverrides)) {
            const service = versionedServiceMap[versionedServiceName];
            config.services[service.name].location = `http://${ipV4Address}:${service.port}`;
        }
        await writeFile(bindersConfigSecretPath, JSON.stringify(config, null, 4));
        log(`Dumped BindersConfig to ${underline(bindersConfigSecretPath)}`)
    } else {
        log(`BindersConfig already exists at ${underline(bindersConfigSecretPath)}`)
    }

    log();
    const dc = buildDockerCompose({
        bindersConfigSecretPath,
        elasticPath: devConfig.elasticPathPrefix ?? "/data/elastic7",
        gid: process.getgid(),
        ipOverrides: ipV4AddressesOverrides,
        localhostDomain: options.domain,
        mode: options.buildAndRun ? "build-and-run" : "development",
        mongoPath: devConfig.hostPathFolder,
        reverseProxyIpV4: "172.0.30.80",
        versionedServiceMap,
        subnet: "172.0.30.0/24",
        typescriptCompiler: devConfig.devTypeScriptCompiler,
        uid: process.getuid(),
        webAppBundler: devConfig.webAppBundler,
    });
    const dockerComposeYmlPath = `${__dirname}/../../../../../docker-compose.yml`;
    await dumpYaml(dc, dockerComposeYmlPath);
    log(`Dumped docker-compose.yml to ${underline(await realpath(dockerComposeYmlPath))}`);

    log();
    log(`${bold(green("Finished"))}

To start all services, run
${bold("docker compose up -d")}

To start API services, run
${bold("just up-api")}

To start Web services, run
${bold("just up-web")}
`);
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch (e) {
        log(`Path ${path} does not exist`);
        return false;
    }
}

doIt().catch(log);

