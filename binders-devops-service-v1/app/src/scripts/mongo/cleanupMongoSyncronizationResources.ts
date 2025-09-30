import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { deleteK8sResouce } from "../../actions/k8s/delete";
import { generateMongoLoadBalancerServiceName } from "../../actions/mongo/k8s";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

interface SyncMongoClusterOptions {
    namespace: string
    sourceK8sCluster: string;
    sourceMongoCluster: string;
    targetK8sCluster: string;
    targetMongoCluster: string;
}

function getOptions(): SyncMongoClusterOptions {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespace in both clusters",
            default: "production",
            kind: OptionType.STRING
        },
        sourceK8sCluster: {
            long: "sourceK8sCluster",
            short: "s",
            kind: OptionType.STRING,
            description: "Name of k8s cluster from which data will be moved",
        },
        targetK8sCluster: {
            long: "targetK8sCluster",
            short: "t",
            kind: OptionType.STRING,
            description: "Name of the new k8s cluster",
        },
        sourceMongoCluster: {
            long: "sourceMongoCluster",
            kind: OptionType.STRING,
            default: "mongo-main-service",
            description: "Name of k8s cluster from which data will be moved",
        },
        targetMongoCluster: {
            long: "targetMongoCluster",
            kind: OptionType.STRING,
            default: "mongo-service",
            description: "Name of the new k8s cluster",
        },
    }
    const parser = new CommandLineParser("SyncMongoClusterOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { namespace, sourceK8sCluster, sourceMongoCluster, targetK8sCluster, targetMongoCluster } = (<any>parser.parse()) as SyncMongoClusterOptions

    return {
        namespace,
        sourceK8sCluster,
        sourceMongoCluster,
        targetK8sCluster,
        targetMongoCluster,
    }
}

const toMongoService = (mongoReleaseName: string) => `${mongoReleaseName}-mongodb-service`

async function deleteProxyService(namespace: string, service: string) {
    await deleteK8sResouce(service, namespace, "service")
}

async function cleanupSyncronizationResources(clusterName: string, mongoRelease: string, namespace: string, source: boolean) {
    await runGetKubeCtlConfig(clusterName, true)

    // cleanup services
    const servicesToDelete = [0, 1, 2].map(index => generateMongoLoadBalancerServiceName(index, source))
    await Promise.all(servicesToDelete.map(service => deleteK8sResouce(service, namespace, "service")))
    await deleteProxyService(namespace, toMongoService(mongoRelease))
    // cleanup proxies
    const deploysToDelete = [0, 1, 2].map(index => `mongo-${index}`)
    await Promise.all(deploysToDelete.map(deployment => deleteK8sResouce(deployment, namespace, "deployment")))
    // delete configmaps
    const configMapsToDelete = [0, 1, 2].map(index => `nginx-conf-${index}`)
    await Promise.all(configMapsToDelete.map(configMap => deleteK8sResouce(configMap, namespace, "configmap")))
}

main(async () => {
    const { namespace, sourceK8sCluster, sourceMongoCluster, targetK8sCluster, targetMongoCluster } = getOptions()
    // Small note: for destroying mongo proxy services we need to pass oposite mongo release names
    await cleanupSyncronizationResources(sourceK8sCluster, targetMongoCluster, namespace, true)
    await cleanupSyncronizationResources(targetK8sCluster, sourceMongoCluster, namespace, false)
})