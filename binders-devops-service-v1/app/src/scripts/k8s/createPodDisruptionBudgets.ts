import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    createOrUpdatePdb,
    getPodDisruptionBudgetSpec
} from "../../lib/k8s/podDistruptionBudget";
import { createKubeConfig } from "../../actions/k8s-client/util";
import { main } from "../../lib/program";

const PRODUCTION_NAMESPACE = "production"
const MONITORING_NAMESPACE = "monitoring"

const getOptions = (): { aksClusterName: string } => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The name of the aks cluster",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("printNodeLabels", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<unknown>parser.parse()) as any;
};

const doIt = async () => {
    const { aksClusterName } = getOptions();

    const kubeConfig = await createKubeConfig(aksClusterName, { useAdminContext: true });

    const redisSpec = getPodDisruptionBudgetSpec("app.kubernetes.io/name", "redis")
    await createOrUpdatePdb(kubeConfig, "redis", PRODUCTION_NAMESPACE, redisSpec)

    const mongoSpec = getPodDisruptionBudgetSpec("role", "mongo-service-mongo")
    await createOrUpdatePdb(kubeConfig, "mongo", PRODUCTION_NAMESPACE, mongoSpec)

    const bindersSpec = getPodDisruptionBudgetSpec("elasticsearch.k8s.elastic.co/cluster-name", "binders")
    await createOrUpdatePdb(kubeConfig, "binders-es-default", PRODUCTION_NAMESPACE, bindersSpec)

    const logeventsSpec = getPodDisruptionBudgetSpec("elasticsearch.k8s.elastic.co/cluster-name", "logevents-new")
    await createOrUpdatePdb(kubeConfig, "logevents-new-es-default", MONITORING_NAMESPACE, logeventsSpec)

}

main(doIt)

