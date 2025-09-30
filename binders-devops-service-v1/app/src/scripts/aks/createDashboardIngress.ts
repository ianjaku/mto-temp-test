import { BackendProtocol, IIngress, buildIngress } from "../../actions/k8s/ingress";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { dumpAndRunKubeCtl } from "../../lib/k8s";
import { main } from "../../lib/program";



const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        cluster: {
            long: "cluster",
            short: "c",
            description: "Cluster in which ingress should be created",
            kind: OptionType.STRING,
            required: false
        }
    };

    const parser = new CommandLineParser("k8sdashboard", programDefinition);
    return parser.parse();
};

enum Cluster {
    Staging = "stg",
    Production = "prod"
}

const doIt = async () => {
    const { cluster } = getOptions()
    const host = cluster === Cluster.Staging ? "k8s.staging.binders.media" : "k8s.binders.media"
    const hosts = [ host ];
    const ingressDefinition: IIngress = {
        name: "k8s-dashboard",
        labels: { "ingress": "k8s-dashboard" },
        rules: [
            {
                hosts
            }
        ],
        backend: {
            name: "kubernetes-dashboard",
            port: 443
        },
        tlsConfig: {
            hosts,
            secretName: cluster === Cluster.Staging ? "tls-staging-secret" : "tls-production-secret"
        },
        backendProtocol: BackendProtocol.HTTPS
    };
    const ingress = buildIngress(ingressDefinition, "kubernetes-dashboard");
    await dumpAndRunKubeCtl(ingress, "ingress-k8s-dashboard", false);
};

main(doIt);