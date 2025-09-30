/* eslint-disable no-console */
const os = require("os");
const fs = require("fs");

const ENV_FILE_LOCATION = ".env";
const INTERFACE_BLACKLIST = [
    "vEthernet (DockerNAT) 2"
]

const systemInterfaces = os.networkInterfaces();

const getLocalIp = (interfaceName = undefined) => {
    let aliasIndex;
    for (let ifname in systemInterfaces) {
        if (interfaceName === undefined && INTERFACE_BLACKLIST.indexOf(ifname) === -1) {
            console.log(`Using first available valid interface: ${ifname}`);
            interfaceName = ifname;
        }
        if (ifname !== interfaceName) {
            continue;
        }
        const interfaceAliases = systemInterfaces[ifname];
        for (aliasIndex=0; aliasIndex < interfaceAliases.length; aliasIndex++) {
            const interface = interfaceAliases[aliasIndex];
            if (interface.family !== "IPv4") {
                continue;
            }
            console.log("Using IP", interface.address);
            return interface.address;
        }
    }
    throw new Error(`Network interface not found ${interfaceName} (${aliasIndex})`);
};

const updateEnv = () => {
    const fileContents = fs.readFileSync(ENV_FILE_LOCATION);
    const updatedContent = fileContents.toString()
        .split("\n")
        .map(line => {
            if (line.startsWith("IP")) {
                return `IP=${getLocalIp()}`;
            }
            return line;
        })
        .join("\n");
    fs.writeFileSync(ENV_FILE_LOCATION, updatedContent);
}

updateEnv();
