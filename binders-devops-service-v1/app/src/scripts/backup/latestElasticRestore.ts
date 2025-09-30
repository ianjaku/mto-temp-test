import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { ITunnelSpec, withTunnel } from "../../actions/k8s/tunnels";
import { NUMBER_OF_PRODUCTION_NODES, getElasticUserPassword } from "../../lib/eck";
import {
    ProductionBackupConfig,
    buildBackupConfig,
    getNewClusterPodNames,
    loadProductionSecrets
} from  "../../lib/bindersconfig";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getElasticClientForRestoreSnapshot } from "../../actions/elastic/config";
import { isProduction } from "../../lib/environment";
import { main } from "../../lib/program";
import { runLatestRestore } from "../../actions/elastic/devRestore";
import { sleep } from "../../lib/promises";

interface IRestoreConfig {
    backupConfig: ProductionBackupConfig
    clusterName: string
    localPort: number;
    elasticPassword?: string;
    customSnapshotName?: string;
    indices?: string[];
}

interface IElasticRestoreOptions {
    customSnapshotName: string;
    namespace: string;
    indices: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        customSnapshotName: {
            long: "customSnapshotName",
            short: "s",
            description: "Desired snapshot name to restore",
            kind: OptionType.STRING
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "Desired namespace where restore will take place",
            kind: OptionType.STRING
        },
        indices: {
            long: "indices",
            short: "i",
            description: "Comma separated list of indices to restore",
            kind: OptionType.STRING
        }
    }
    const parser = new CommandLineParser("IElasticRestoreOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { customSnapshotName, namespace, indices } = (<any>parser.parse()) as IElasticRestoreOptions
    return {
        customSnapshotName,
        namespace,
        indices
    }
}



const newClusterRestoreAction = (config: IRestoreConfig) => async () => {
    const { backupConfig, localPort, elasticPassword, customSnapshotName, indices } = config
    await sleep(3000);
    const client = getElasticClientForRestoreSnapshot(elasticPassword, localPort)
    await runLatestRestore(client, backupConfig.elastic.bindersAzure, customSnapshotName, indices)
}

const getPodName = (): string => {
    return getNewClusterPodNames(NUMBER_OF_PRODUCTION_NODES)[0]
}

const doIt = async () => {
    const { customSnapshotName, indices, namespace } = getOptions()
    const localPort = 9200;
    const secrets = await loadProductionSecrets();
    const backupConfig = buildBackupConfig(secrets);
    const clusterName = "binders";
    const choosenNamespace = isProduction() ?
        PRODUCTION_NAMESPACE :
        namespace
    if (isProduction()) {
        throw new Error("No restores to production cluster.")
    }


    const pod = await getPodName()
    const spec: ITunnelSpec = {
        pod, localPort, remotePort: 9200, namespace: choosenNamespace
    };
    const restoreConfig: IRestoreConfig = {
        backupConfig,
        clusterName,
        localPort,
        customSnapshotName,
        indices: indices?.split(",").map(i => i.trim())
    }

    const elasticPassword = await getElasticUserPassword(choosenNamespace)
    restoreConfig.elasticPassword = elasticPassword
    await withTunnel(spec, newClusterRestoreAction(restoreConfig));
}

main(doIt);