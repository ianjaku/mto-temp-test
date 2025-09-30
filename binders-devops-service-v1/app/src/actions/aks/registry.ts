
// az acr repository show-manifests -n MyRegistry --repository MyRepository


import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import log from "../../lib/logging";

const EXCLUDED_REPOSITORIES = ["ubuntu-devops", "bitbucket-after-build", "bitbucket-alpine", "playwright-az"]

export interface ImageVersion {
    digest: string;
    tags: string[];
    timestamp: Date;
}

export async function listRepositories(registryName: string): Promise<string[]> {
    const args = [
        "acr", "repository", "list", "-n", registryName
    ];
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    try {
        const repositories = JSON.parse(output);
        return repositories.filter((repository: string) => {
            return !EXCLUDED_REPOSITORIES.includes(repository);
        });

    } catch (err) {
        log("FAILED PARSING JSON:");
        log(output);
        throw err;
    }
}

export async function listImageVersions(registryName: string, imageName: string): Promise<ImageVersion[]> {
    const args = [
        "acr", "repository", "show-manifests",
        "-n", registryName,
        "--repository", imageName
    ];
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    try {
        const lines = output.split("\n");
        while (lines[0].startsWith("WARNING:")) {
            lines.shift();
        }
        return JSON.parse(lines.join("\n"));
    } catch (err) {
        log("FAILED PARSING JSON:");
        log(output);
        throw err;
    }
}

export async function deleteImageVersion(registryName: string, imageName: string, version: ImageVersion): Promise<void> {
    const imageWithDigest = `${imageName}@${version.digest}`;
    const args = [
        "acr", "repository", "delete",
        "-n", registryName,
        "--image", imageWithDigest,
        "--yes"
    ];
    // eslint-disable-next-line no-console
    console.log("Deleting image", imageWithDigest);
    try {
        await buildAndRunCommand(() => buildAzCommand(args));
    } catch (err) {
        if ((!err.output) || err.output.indexOf(`${version.digest} is not found`) === -1) {
            throw err;
        }
        // eslint-disable-next-line no-console
        console.log("Image with digest does not exist.");
    }
}