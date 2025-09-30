/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */
import * as protobuf from "./hapi/release/release_pb";
import * as util from "util";
import * as zlib from "zlib";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { any, clone } from "ramda";
import {
    buildAndRunCommand,
    buildHelmCommand,
    buildKubeCtlCommand,
    runCommand
} from  "../../lib/commands";
import { dumpYaml, yamlParse, yamlStringify } from "../../lib/yaml";
import { main } from "../../lib/program";

const KUBE_NAMESPACE = "kube-system"

interface K8sUpgradeConfigMapOptions {
    helmDeploymentName: string
    dryRun: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        helmDeploymentName: {
            long: "helm-deployment-name",
            short: "n",
            description: "Helm deployment name to change",
            kind: OptionType.STRING,
            required: false,
        },
        dryRun: {
            long: "dry-run",
            short: "d",
            kind: OptionType.BOOLEAN,
            description: "Dry run",
            default: false
        }
    }
    const parser = new CommandLineParser("k8sUpgrade", programDefinition)
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as K8sUpgradeConfigMapOptions
}

async function getConfigMapData(helmDeploymentName: string): Promise<string> {
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand([
        "get", "configmaps", "--namespace", KUBE_NAMESPACE, "--selector", `NAME=${helmDeploymentName},STATUS=DEPLOYED`, "-o", "yaml"
    ]), { mute: true });
    return output.trim()
}

async function saveConfigMapChanges(yamlConfigPath) {
    const args = ["apply", "-f", yamlConfigPath, "--namespace", KUBE_NAMESPACE]
    await buildAndRunCommand(() => buildKubeCtlCommand([...args, "--dry-run"]), { mute: true })
    await buildAndRunCommand(() => buildKubeCtlCommand(args), { mute: true })
}

async function decodeRelease(release: string): Promise<protobuf.Release> {
    const gunzip = util.promisify(zlib.gunzip)
    const decodedBase64 = Buffer.from(release, "base64")
    const unzippedConfigMap = await gunzip(decodedBase64);
    return protobuf.Release.deserializeBinary(unzippedConfigMap);
}

async function encodeRelease(configMap: protobuf.Release): Promise<string> {
    const binary = configMap.serializeBinary()
    const gzip = util.promisify(zlib.gzip)
    const zippedConfig = await gzip(binary)
    const buffer = zippedConfig as Buffer
    return buffer.toString("base64")
}

interface ResourceType {
    apiVersion: string;
    kind: string;
}

interface ResourceTypeMatcher {
    apiVersions: string[];
    kind: string;
}

interface Upgrade<T> {
    (input: T): T
}

interface UpgradeDefinition<T = {}> {
    matcher: ResourceTypeMatcher;
    upgrade: Upgrade<T>
}


const buildMatcher = (apiVersions: string[], kind: string) => ({
    apiVersions,
    kind
});

const replaceApiVersion = (apiVersion: string) => (
    (object: { apiVersion: string }) => ({
        ...object,
        apiVersion
    })
);

function safeSet(o: {}, keys: string[], value) {
    const head = keys.shift();
    if (keys.length === 0) {
        o[head] = value;
        return;
    }
    if (!(head in o)) {
        o[head] = {}
    }
    safeSet(o[head], keys, value);
}


const DAEMONSET_SELECTOR_FIXES = {
    "filebeat": {
        "matchLabels": {
            "k8s-app": "filebeat",
            "kubernetes.io/cluster-service": "true"
        }
    },
    "mongo-setup-mongo-hostvm-configurer": {
        "matchLabels": {
            "app": "mongo-setup-startup-script"
        }
    }
};

function upgradeDaemonSet(set) {
    const duplicated = clone(set);
    duplicated.apiVersion = "apps/v1";
    if (!duplicated.spec.selector) {
        if (duplicated.spec.templateGeneration) {
            safeSet(duplicated, ["spec", "selector"], duplicated.spec.templateGeneration);
        } else {
            const fix = DAEMONSET_SELECTOR_FIXES[duplicated.metadata.name];
            if (fix) {
                safeSet(duplicated, ["spec", "selector"], fix);
            } else {
                throw new Error("Cannot upgrade daemonset: no selector, no templateGeneration");
            }
        }

    }
    delete duplicated.spec.templateGeneration;
    safeSet(duplicated, ["spec", "updateStrategy", "type"], "OnDelete");
    return duplicated;
}

const DEPLOYMENT_SELECTOR_FIXES = {
    "nginx-ingress-controller-controller": {
        "matchLabels": {
            "app": "nginx-ingress",
            "component": "controller",
            "release": "nginx-ingress-controller"
        }
    },
    "nginx-ingress-controller-default-backend": {
        "matchLabels": {
            "app": "nginx-ingress",
            "component": "default-backend",
            "release": "nginx-ingress-controller"
        }
    }
}

function upgradeDeployment(dep) {
    const duplicated = clone(dep);
    duplicated.apiVersion = "apps/v1";
    delete duplicated.spec.rollbackTo;
    if (!duplicated.spec.selector) {
        const fix = DEPLOYMENT_SELECTOR_FIXES[duplicated.metadata.name];
        if (fix) {
            duplicated.spec.selector = fix;
        } else {
            throw new Error("Cannot upgrade deployment: no selector");
        }
    }
    return duplicated;
}

function upgradeStatefulSet(ss) {
    const duplicated = clone(ss);
    duplicated.apiVersion = "app/v1";
    if (!duplicated.spec.selector) {
        throw new Error("Cannot upgrade stateful set: no selector");
    }
    safeSet(duplicated, ["spec", "updateStrategy", "type"], "OnDelete");
    return duplicated;
}

function upgradeReplicaSet(rs) {
    const duplicated = clone(rs);
    duplicated.apiVersion = "app/v1";
    if (!duplicated.spec.selector) {
        throw new Error("Cannot upgrade deployment: no selector");
    }
    return duplicated;
}

const OBJECT_TYPE_UPGRADES: UpgradeDefinition[] = [
    {
        matcher: buildMatcher(["extensions/v1beta1"], "NetworkPolicy"),
        upgrade: replaceApiVersion("networking.k8s.io/v1")
    },
    {
        matcher: buildMatcher(["extensions/v1beta1"], "PodSecurityPolicy"),
        upgrade: replaceApiVersion("policy/v1beta1")
    },
    {
        matcher: buildMatcher(["extensions/v1beta1", "apps/v1beta2"], "DaemonSet"),
        upgrade: upgradeDaemonSet
    },
    {
        matcher: buildMatcher(["extensions/v1beta1", "apps/v1beta1", "apps/v1beta2"], "Deployment"),
        upgrade: upgradeDeployment
    },
    {
        matcher: buildMatcher(["apps/v1beta1", "apps/v1beta2"], "StatefulSet"),
        upgrade: upgradeStatefulSet
    },
    {
        matcher: buildMatcher(["extensions/v1beta1", "apps/v1beta1", "apps/v1beta2"], "ReplicaSet"),
        upgrade: upgradeReplicaSet
    },
    {
        matcher: buildMatcher(["extensions/v1beta1"], "Ingress"),
        upgrade: replaceApiVersion("networking.k8s.io/v1beta1")
    }
];

function shouldUpgrade(object: ResourceType, matcher: ResourceTypeMatcher) {
    return (
        object.kind === matcher.kind &&
        any(v => object.apiVersion === v, matcher.apiVersions)
    );
}

function upgradeObjectType(object: ResourceType, upgradeDef: UpgradeDefinition) {
    if (shouldUpgrade(object, upgradeDef.matcher)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log(`\tUpgrading ${upgradeDef.matcher.kind} ${(object as any).metadata.name}`)
        return upgradeDef.upgrade(object);
    }
    return object;
}

function updateManifest(manifest: string): string {
    const manifestDocs = manifest.split("---");
    const updatedDocs = [];
    for (const manifestDoc of manifestDocs) {
        const decodedDoc = yamlParse<ResourceType>(manifestDoc);
        if (!decodedDoc) {
            updatedDocs.push("\n");
            continue;
        }
        const trimmedDoc = manifestDoc.trim();
        const comment = trimmedDoc[0] === "#" ?
            `${trimmedDoc.split("\n")[0]}\n` :
            "";
        const updated = OBJECT_TYPE_UPGRADES.reduce(
            (reduced, upgrade) => upgradeObjectType(reduced, upgrade),
            decodedDoc
        );
        updatedDocs.push(`${comment}${yamlStringify(updated)}`);
    }
    return updatedDocs.join("---\n");
}

async function saveConfigFile(config, encodedRelease: string): Promise<string> {
    config.items[0].data.release = encodedRelease
    config.items[0].metadata = removedConflictedProps(config.items[0].metadata)
    const targetDirectory = "/tmp/k8s/helmUpgrade";
    await runCommand("mkdir", ["-p", targetDirectory]);
    const targetFile = `${targetDirectory}/configMap.yml`;
    await dumpYaml(config, targetFile)

    return targetFile
}

function removedConflictedProps(metadata) {
    delete metadata.resourceVersion
    delete metadata.selfLink
    delete metadata.uid
    return metadata
}

async function getHelmDeploymentsNames() {
    const { output } = await buildAndRunCommand(() => buildHelmCommand(["ls", "--tls"]), { mute: true });
    const [_, ...deployments] = output.trim().split("\n")
    return deployments.map(d => d.split("\t")[0].trim())
}

const doIt = async () => {
    const { helmDeploymentName, dryRun } = getOptions()

    const deployments = helmDeploymentName ? [helmDeploymentName] : await getHelmDeploymentsNames();

    for (const deployment of deployments) {
        console.log(`Inspecting helm deployment ${deployment}`);
        const configMap = await getConfigMapData(deployment)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = yamlParse<any>(configMap);
        const release = config.items[0].data.release
        const decodedRelease = await decodeRelease(release)
        const manifest = decodedRelease.getManifest()
        const newManifest: string = updateManifest(manifest);

        if (!dryRun) {
            console.log("Saving update to tiller configMap");
            decodedRelease.setManifest(newManifest)
            const encodedRelease = await encodeRelease(decodedRelease)
            const yamlConfigPath = await saveConfigFile(config, encodedRelease)
            await saveConfigMapChanges(yamlConfigPath)
        }
    }
}

main(doIt)