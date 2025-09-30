/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { homedir } from "os";
import { log } from "../../lib/logging";

export const getVms = async (resourceGroup: string) => {
    const args = [
        "vm", "list", "--resource-group", resourceGroup, "-o", "json"
    ];
    const { output } = await buildAndRunCommand(
        () => buildAzCommand(args),
        { mute: true }
    );
    return JSON.parse(output);
};

export const copySshKey = async (resourceGroup: string, vm: string) => {
    const publicKey = `${homedir()}/.ssh/id_rsa.pub`;
    const args = [
        "vm", "user", "update",
        "--resource-group", resourceGroup,
        "--name", vm,
        "--username", "azureuser",
        "--ssh-key-value", publicKey
    ];
    const cmd = buildAzCommand(args);
    log([cmd.command, ...cmd.args].join(" "));
    const { output } = await buildAndRunCommand(() => cmd);
    return output;
};

export const getVmIps = async (resourceGroup: string) => {
    const args = [
        "vm", "list-ip-addresses",
        "--resource-group", resourceGroup,
        "-o", "json"
    ];
    const { output } = await buildAndRunCommand(
        () => buildAzCommand(args),
        { mute: true }
    );
    return JSON.parse(output);
};
