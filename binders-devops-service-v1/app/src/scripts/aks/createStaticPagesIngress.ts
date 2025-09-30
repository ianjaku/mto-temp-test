import { IIngress, buildIngress } from "../../actions/k8s/ingress";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { STATIC_PAGE_DOMAINS } from "../../lib/staticsites";
import { dumpAndRunKubeCtl } from "../../lib/k8s";
import { getProductionCluster } from "../../actions/aks/cluster";
import { getStaticPagesTLSSecretName } from "../../actions/k8s/secrets";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";

const doIt = async () => {

    await runGetKubeCtlConfig(getProductionCluster());

    const hosts = [
        ...STATIC_PAGE_DOMAINS
    ];
    const ingressDefinition: IIngress = {
        name: "static-pages",
        labels: { "ingress": "static-pages" },
        rules: [
            {
                hosts
            }
        ],
        backend: {
            name: "static-pages-v1-service",
            port: 8082
        },
        tlsConfig: {
            hosts,
            secretName: getStaticPagesTLSSecretName()
        },
    };
    const ingress = buildIngress(ingressDefinition, PRODUCTION_NAMESPACE);
    await dumpAndRunKubeCtl(ingress, "ingress-static-pages", false);

};

main(doIt);