/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */


import { buildAndRunCommand, buildHelmCommand } from "../../lib/commands";
import { log } from "../../lib/logging";

export const runHelmDependencyUpdate = async (pathToShardDir: string) => {
    await buildAndRunCommand(
        () => buildHelmCommand(["dependency", "update"]),
        { cwd: pathToShardDir }
    );
};

export const maybeAddHelmRepo = async (name: string, url: string): Promise<void> => {
    const listRepoParams = ["repo", "list", "--output", "json"]
    const { output } = await buildAndRunCommand(
        () => buildHelmCommand(listRepoParams),
        { mute: true }
    );

    if (!output || JSON.parse(output).filter(repo => repo.url === url).length === 0) {
        await buildAndRunCommand(() => buildHelmCommand(["repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx"]));
        await buildAndRunCommand(() => buildHelmCommand(["repo", "update"]));
    }

}

export const helmReleaseExists = async (releaseName: string, namespace?: string) => {
    const ns = namespace ? namespace : releaseName
    const params = ["get", "all", releaseName, "-n", ns];
    try {
        await buildAndRunCommand(
            () => buildHelmCommand(params),
            { mute: true }
        );
        return true
    } catch (error) {
        return false
    }

};

export const runHelmInstall = async (chartName: string, releaseName: string, pathToShardDir = ".",
    valuesFilePath?: string, namespace?: string, extraValues?: Object, version?: string, createNamespace?: boolean, extraFile?: Object) => {

    const infix = (await helmReleaseExists(releaseName, namespace)) ?
        ["upgrade"] :
        ["install"];
    const params = [
        ...infix,
        releaseName,
        chartName
    ];
    if (valuesFilePath) {
        params.push("-f", valuesFilePath);
    }
    if (namespace) {
        params.push("--namespace", namespace);
    }
    if (createNamespace) {
        params.push("--create-namespace")
    }
    if (extraValues) {
        const values = [];
        for (const key in extraValues) {
            values.push(`${key}=${extraValues[key]}`);
        }
        params.push("--set", values.join(","));
    }
    if (version) {
        params.push("--version", version)
    }
    if (extraFile) {
        const values = [];
        for (const key in extraFile) {
            values.push(`${key}=${extraFile[key]}`);
        }
        params.push("--set-file", values.join(","));
    }
    return buildAndRunCommand(
        () => buildHelmCommand(params),
        { cwd: pathToShardDir, mute: true }
    );
};

export const checkIfHelmRepositoryExists = async (repoName = "stable"): Promise<boolean> => {
    try {
        const params = ["repo", "list"];
        const listInstallsResult = await buildAndRunCommand(
            () => buildHelmCommand(params),
            { mute: true }
        );
        const listInstallsOutput = listInstallsResult.output;
        const installs = listInstallsOutput.toString().split(/\n|\t/).filter(l => !!l).map(t => t.trim());
        return !!installs.find(i => i === repoName.trim());
    } catch (err) {
        log(err)
        return false
    }
}

export const addHelmRepo = async (name: string, url: string) => {
    await buildAndRunCommand(
        () => buildHelmCommand(["repo", "add", name, url]),
        { mute: true }
    );
}

export const updateHelmRepoCache = async () => {
    await buildAndRunCommand(
        () => buildHelmCommand(["repo", "update"]),
        { mute: false }
    );
}