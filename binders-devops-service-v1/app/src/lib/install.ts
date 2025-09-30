/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildHelmCommand, runCommand } from "./commands";
import { helmReleaseExists, maybeAddHelmRepo } from "../actions/helm/install";
import { dumpYaml } from "./yaml";
import { getStaticPagesRepository } from "../actions/docker/build";


export const runScript = async (scriptLocation, args, options) => {
    await runCommand("tsx", [scriptLocation, ...args], options);
};


export const runCreateCluster = (aksClusterOptions, scriptOptions) => {
    return runScript(
        "src/scripts/aks/createAKSCluster.ts",
        [
            "-n", aksClusterOptions.name,
            "--location", aksClusterOptions.location,
            "--number-of-nodes", aksClusterOptions.numberOfNodes.toString(),
            "--instance-disk-size", aksClusterOptions.diskSize.toString(),
            "--instance-type", (aksClusterOptions.instanceType || "Standard_D2s_v2")
        ],
        scriptOptions
    );
};

export const runSetupDevops = (clusterName, scriptOptions) => {
    return runScript(
        "src/scripts/aks/setupDevops.ts",
        [
            "-n", clusterName
        ],
        scriptOptions
    );
};

export const runInstallHelm = async (clusterName, scriptOptions) => {
    await runScript(
        "src/scripts/helm/install.ts",
        [
            "-n", clusterName
        ],
        scriptOptions
    );
};

export const runInstallIngressController = async (env: "production" | "staging", virtualIp?: string) => {
    const secret = (env === "production") ?
        "production/tls-production-secret" :
        "default/tls-staging-secret";

    await maybeAddHelmRepo("ingress-nginx", "https://kubernetes.github.io/ingress-nginx")
    const values = {
        controller: {
            config: {
                "http2-max-field-size": "64k"
            },
            extraArgs: {
                "default-ssl-certificate": secret
            },
            image: {
                tag: "v1.1.1",
            },
            metrics: {
                enabled: true
            },
            podAnnotations: {
                "prometheus.io/port": 10254,
                "prometheus.io/scrape": "true"
            },
            replicaCount: 5,
            service: {
                externalTrafficPolicy: "Local"
            },
            stats: {
                enabled: true
            }
        },
        defaultBackend: {
            image: {
                repository: getStaticPagesRepository(),
                tag: "latest",
                pullPolicy: "Always",
            },
            port: 80
        },
        rbac: {
            create: true
        },
    };
    const valuesFile = "/tmp/nginx-controller-values.yml";
    await dumpYaml(values, valuesFile);
    const releaseName = "ingress-nginx";
    const exists = await helmReleaseExists(releaseName);
    const infix = exists ? ["upgrade"] : ["install"];
    const args = [
        ...infix, releaseName,
        "ingress-nginx/ingress-nginx",
        "-f", valuesFile
    ];
    if (virtualIp) {
        args.push("--set", `controller.service.loadBalancerIP=${virtualIp}`);
    }
    await buildAndRunCommand( () => buildHelmCommand(args));
};
