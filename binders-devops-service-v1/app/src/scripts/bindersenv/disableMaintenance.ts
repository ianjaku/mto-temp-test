import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { getProductionCluster, getStagingCluster } from "../../actions/aks/cluster";
import { toIngress, toOfflineIngress } from "../../lib/k8s/ingress";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { EnvironmentStatus } from "../../lib/bindersenvironment";
import { dumpFile } from "../../lib/fs";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { runKubeCtlFile } from "../../lib/k8s";

interface MaintenanceOptions {
    namespace: string,
    isProduction: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "k8s namespaces",
            kind: OptionType.STRING,
            required: true
        },
        isProduction: {
            long: "isProduction",
            short: "p",
            kind: OptionType.BOOLEAN,
            description: "Production env",
        }
    }
    const parser = new CommandLineParser("MaintenanceOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { isProduction, namespace } = (<any>parser.parse()) as MaintenanceOptions
    return {
        isProduction: !!isProduction,
        namespace
    }
}

const getBindersEnv = (isProduction = false, branch = "develop") => {
    if(isProduction) {
        return {
            isProduction: true,
            branch: "none-existing-branch",
            commitRef: "none-existing-commit",
            services: BINDERS_SERVICE_SPECS,
            status: EnvironmentStatus.ONLINE
        };
    } else {
        return {
            isProduction: false,
            branch,
            commitRef: "none-existing-commit",
            services: BINDERS_SERVICE_SPECS,
            status: EnvironmentStatus.ONLINE
        };
    }
}

const doIt = async () => {
    const { namespace, isProduction } = getOptions()
    const env = getBindersEnv(isProduction, namespace)
    const cluster = isProduction ? getProductionCluster() : getStagingCluster()
    await runGetKubeCtlConfig(cluster);
    const ingress = toIngress(env);
    const oIngress = toOfflineIngress(env);
    const file = "/tmp/temp-ingress2.yml";
    await dumpFile(file, `${ingress}\n---\n${oIngress}`);
    return runKubeCtlFile(file, false, namespace);
};

main( doIt );