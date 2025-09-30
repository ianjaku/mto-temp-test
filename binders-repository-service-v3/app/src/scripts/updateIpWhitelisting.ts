/* eslint-disable no-console */
import { BackendRoutingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { readFileSync } from "fs-extra";

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <DOMAIN> <CIDRS_FILE>`);
        process.exit(1);
    }
    return {
        domain: process.argv[2],
        cidrFile: process.argv[3]
    };
};

const getClient = async () => {
    const config = BindersConfig.get();
    return BackendRoutingServiceClient.fromConfig(config, "update-ip-whitelist");
}

const getCidrs = (file) => {
    const content = readFileSync(file);
    return content.toString()
        .split("\n")
        .map(l => l.trim())
        .filter(l => !!l)
}

const doIt = async () => {
    const { domain, cidrFile } = getOptions();
    const client = await getClient();
    const CIDRs = getCidrs(cidrFile);
    if (!CIDRs || CIDRs.length === 0) {
        throw new Error("Script does not allow deleting of whitelists");
    }
    await client.saveIpWhitelist({
        domain,
        CIDRs,
        enabled: true
    });
    const current = await client.getIpWhitelist(domain);
    console.log("IP Whitelist is now:");
    console.log(JSON.stringify(current, null, 4));
}


doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.error(error);
        process.exit(1);
    });