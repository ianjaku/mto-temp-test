/* eslint-disable no-console */
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { getAKSCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";



async function restartDeployments(namespace: string) {
    try {
        const getDeploymentsArgs = ["get", "deployments", "-n", namespace, "-o", "name"]
        const { output } = await buildAndRunCommand(
            () => buildKubeCtlCommand(getDeploymentsArgs),
            { mute: true }
        );
        const deployments = output
            .split("\n")
            .filter(x => x) //get rid of empty string at the end
        for (const deployment of deployments) {
            console.log(`Restarting deployment ${deployment} in namespace ${namespace}`);
            const restartDeployArgs = ["rollout", "restart", deployment, "-n", namespace]
            await buildAndRunCommand(
                () => buildKubeCtlCommand(restartDeployArgs),
                { mute: true }
            );
        }
        console.log(`All deployments in ${namespace} have been restarted.`);
    } catch (err) {
        console.error(`Error restarting deployments: ${err}`);
    }
}


main(async () => {
    if (process.argv.length !== 3) {
        console.error("Usage: ts-node restartDeployments.ts <namespace>");
        process.exit(1);
    }
    const namespace = process.argv[2];
    const useAdmin = true
    const cluster = getAKSCluster(false)
    await runGetKubeCtlConfig(cluster, useAdmin);
    await restartDeployments(namespace)
})