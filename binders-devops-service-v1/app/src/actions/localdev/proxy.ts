import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { dumpFile } from "../../lib/fs";
import { runCommand } from "../../lib/commands";
import { toNodePort } from "../../lib/devenvironment";

const getServiceProxyConfig = (port: number, internalIp: string) => {
    return `
server {
    listen ${port};
    client_max_body_size 20M;
    location / {
            proxy_pass http://${internalIp}:${toNodePort(port)}/;
    }
}`;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setupProxyConfig = async (internalIp: string) => {
    const portsToProxy = BINDERS_SERVICE_SPECS
        .filter(spec => !spec.sharedDeployment && spec.port)
        .map(spec => spec.port); //toNodePort(spec.port));
    const serviceProxyConfigs = portsToProxy.map(p => getServiceProxyConfig(p, internalIp));
    const configDir = "/tmp/proxy-config";
    const configFile = `${configDir}/manaulto.forward.conf`;
    await runCommand("mkdir", ["-p", configDir]);
    await runCommand("rm", ["-rf", configFile]);
    await dumpFile(configFile, serviceProxyConfigs.join("\n"));
    const portSpecs = portsToProxy.map(p => `-p ${p}:${p}`);
    const command = `docker run --rm ${portSpecs.join(" ")} -v ${configDir}:/etc/nginx/conf.d nginx`;
    // eslint-disable-next-line no-console
    console.log(`Now run: ${command}`)
}