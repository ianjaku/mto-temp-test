import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { runHelmDependencyUpdate, runHelmInstall } from "../../actions/helm/install";
import { HELM_PRODUCTION_ELASTIC_LOGGING_DIR } from "../../lib/helm";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { dumpYaml } from "../../lib/yaml";
import { getClusterConfig } from "../../config/elasticClusters";
import { getHelmElasticReleaseName } from "../../actions/elastic/config";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

interface IInstallKibanaLoggingOptions  {
    elasticClusterName: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        elasticClusterName: {
            long: "elastic-cluster-name",
            short: "n",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            required: true
        },
    };
    const parser = new CommandLineParser("installKibanaLogging", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown> parser.parse()) as IInstallKibanaLoggingOptions;
};

const createValuesFile = async (elasticClusterName, k8sLabel, elasticVersion) => {
    const filePath = "/tmp/kibana-logging-chart-values.yaml";
    const helmReleaseName = getHelmElasticReleaseName(elasticClusterName, "service");
    const elasticHost = `${helmReleaseName}-service`;
    const values = {
        elastic: {
            host: `${elasticHost}.${PRODUCTION_NAMESPACE}`
        },
        kibana: {
            env: {
                ELASTICSEARCH_HOSTS: `http://${elasticHost}:9200`,
                LOGGING_VERBOSE: "true"
            },
            image: {
                repository: "docker.elastic.co/kibana/kibana",
                tag: elasticVersion
            }
        }
    };
    await dumpYaml(values, filePath);
    return filePath;
};

const doIt = async() => {
    const { elasticClusterName } = getOptions();
    const clusterConfig = getClusterConfig(elasticClusterName);
    const { aksClusterName, elasticVersion, k8sNodeLabel } = clusterConfig;
    await runGetKubeCtlConfig(aksClusterName, true);
    const valuesFile = await createValuesFile(elasticClusterName, k8sNodeLabel, elasticVersion);
    await runHelmDependencyUpdate(HELM_PRODUCTION_ELASTIC_LOGGING_DIR);
    await runHelmInstall(".", "kibana-logging", HELM_PRODUCTION_ELASTIC_LOGGING_DIR, valuesFile, PRODUCTION_NAMESPACE);
};

main(doIt);