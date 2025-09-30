import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { createCustomObjectsApi, createKubeConfig } from "../../actions/k8s-client/util";
import type { KubeConfig } from "@kubernetes/client-node";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

interface IUpdateEckClusterOptions {
    clusterName: string;
    eckClusterName: string;
    namespace: string
    targetVersion: string
}

interface ElasticsearchSpec {
    version: string;
}

interface ElasticsearchResource {
    apiVersion?: string;
    kind?: string;
    spec: ElasticsearchSpec;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The name of the kubernetes cluster",
            kind: OptionType.STRING,
            required: true
        },
        eckClusterName: {
            long: "eck-cluster-name",
            short: "e",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            required: true,
            default: "binders"
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            default: "production"
        },
        targetVersion: {
            long: "targetVersion",
            short: "v",
            description: "The elastic target version to upgrade",
            kind: OptionType.STRING,
            default: "7.17.25"
        }
    };
    const parser = new CommandLineParser("IUpdateEckClusterOptions", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as IUpdateEckClusterOptions;
};

async function updateElasticVersion(kc: KubeConfig, elasticName: string, namespace: string, targetVersion: string) {
    try {
        const k8sApi = await createCustomObjectsApi(kc);
        const esResource = await k8sApi.getNamespacedCustomObject({
            group: "elasticsearch.k8s.elastic.co",
            version: "v1",
            namespace,
            plural: "elasticsearches",
            name: elasticName,
        });
        const elasticResource = esResource.body as ElasticsearchResource;
        if (elasticResource?.spec) {
            elasticResource.spec.version = targetVersion;
            await k8sApi.replaceNamespacedCustomObject({
                group: "elasticsearch.k8s.elastic.co",
                version: "v1",
                namespace,
                plural: "elasticsearches",
                name: elasticName,
                body: esResource.body
            });
            log(`Elasticsearch version changed to ${targetVersion}.`);
        } else {
            log("Failed to fetch or invalid Elasticsearch CR.");
        }
    } catch (error) {
        log("Error updating Elasticsearch version:", error);
    }

}

main(async () => {
    const { clusterName, eckClusterName, namespace, targetVersion } = getOptions()
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    await updateElasticVersion(kc, eckClusterName, namespace, targetVersion)
});
