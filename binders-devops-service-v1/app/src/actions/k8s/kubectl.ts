import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { copyFileSync, existsSync } from "fs";
import { dumpYaml, loadYaml } from "../../lib/yaml";
import { format } from "date-fns";
import log from "../../lib/logging";

export const getCurrentContext = async (): Promise<string> => {
    try {
        const { output } = await buildAndRunCommand(
            () => buildKubeCtlCommand(["config", "current-context"]),
            { env: process.env }
        );
        return output.trim();
    } catch (err) {
        log("Could not determine current context");
        // eslint-disable-next-line no-console
        console.error(err);
        return undefined;
    }
};

export const getAllContexts = async (): Promise<string[]> => {
    const { output } = await buildAndRunCommand(
        () => buildKubeCtlCommand(["config", "get-contexts", "-o", "name"]),
        { env: process.env }
    );
    return output.split("\n").filter(l => !!l);
}

export const useContext = async (context: string): Promise<void> => {
    log(`Switching context to ${context}`);
    await buildAndRunCommand(
        () => buildKubeCtlCommand(["config", "use-context", context]),
        { env: process.env }
    );
}

const getContextFromConfig = (contextName: string, config) => {
    const kubectlContext = config.contexts.find(ctx => ctx.name === contextName);
    if (!kubectlContext) {
        throw new Error(`Could not find context ${contextName}`);
    }
    return kubectlContext;
};

const copyContextSettings = (contextName, userName, clusterName, sourceConfig, targetConfig) => {
    const newContexts = targetConfig.contexts
        .filter(ctx => ctx.name !== contextName);
    newContexts.push({
        name: contextName,
        context: { user: userName, cluster: clusterName }
    });
    const user = sourceConfig.users.find(u => u.name === userName);
    const newUsers = targetConfig.users
        .filter(u => u.name !== userName);
    newUsers.push(user);
    const cluster = sourceConfig.clusters.find(c => c.name === clusterName);
    const newClusters = targetConfig.clusters
        .filter(c => c.name !== clusterName);
    newClusters.push(cluster);
    return {
        ...targetConfig,
        contexts: newContexts,
        users: newUsers,
        clusters: newClusters
    };
};

export const copyContext = async (sourceConfigFile: string, targetConfigFile: string, contextName: string): Promise<void> => {
    const sourceConfig = await loadYaml(sourceConfigFile);
    const targetConfig = await loadYaml(targetConfigFile);
    const kubectlContext = getContextFromConfig(contextName, sourceConfig);
    const { user, cluster } = kubectlContext.context;
    const newConfig = copyContextSettings(contextName, user, cluster, sourceConfig, targetConfig);
    await dumpYaml(newConfig, `${targetConfigFile}.new`);
    if (existsSync(targetConfigFile)) {
        copyFileSync(targetConfigFile, `${targetConfigFile}-${format(new Date(), "yyyy-MM-dd")}`);
    }
    copyFileSync(`${targetConfigFile}.new`, targetConfigFile);
};