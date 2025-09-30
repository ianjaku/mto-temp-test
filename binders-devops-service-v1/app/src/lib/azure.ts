/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { buildAndRunCommand, buildAzCommand } from "./commands";

export const listResourceGroups = async () => {
    const commandOutput = await buildAndRunCommand(
        () => buildAzCommand(["group", "list", "--output", "table"]),
        { mute: true }
    );
    const outputLines = commandOutput.output
        .split("\n")
        .filter(l => !!l);

    // Skip the table header
    outputLines.shift();
    outputLines.shift();

    const pattern = /^(\S+)/;
    return outputLines.map(line => {
        const matches = line.match(pattern);
        return matches[1];
    });
};

export const deleteDisk = async (resourceGroupName, diskName) => (
    buildAndRunCommand(() => buildAzCommand([
        "disk", "delete",
        "-g", resourceGroupName,
        "-n", diskName,
        "--yes"
    ]))
);

export const PIPELINE_AZURE_SP_LOGIN = "devops-pipeline";

export const getUserAppId = async (displayName) => {
    const args = [
        "ad", "sp", "list", "--display-name", displayName
    ];
    const { output } = await buildAndRunCommand(() => buildAzCommand(args));
    if (!output) {
        throw new Error("Could not get SP list output");
    }
    const decoded = JSON.parse(output);
    if (!decoded) {
        throw new Error("Could not decode SP list output");
    }
    if (decoded.length > 1) {
        throw new Error("Found multiple matching SPs");
    }
    return decoded[0] && decoded[0].appId;
};
