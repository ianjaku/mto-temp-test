import findIp from "../../lib/findIp";
import loadConfig from "../../lib/loadConfig";
import { main } from "../../lib/program";
import { setupProxyConfig } from "../../actions/localdev/proxy";

const doIt = async () => {
    const configFilePath = `${__dirname}/devConfig.json`;
    const devConfig = await loadConfig(configFilePath);
    const ip = await findIp(devConfig);
    await setupProxyConfig(ip);
}

main(doIt);