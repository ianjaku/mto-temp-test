/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    addHelmRepo,
    checkIfHelmRepositoryExists,
    runHelmInstall,
    updateHelmRepoCache
} from "../../actions/helm/install";
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { createSecret, getK8SSecret, getTLSSecretName } from "../../actions/k8s/secrets";
import { Env } from "../../lib/environment";
import { IBindersEnvironment } from "../../lib/bindersenvironment";
import { STATIC_PAGE_DOMAINS } from "../../lib/staticsites";
import { WILDCARD_DOMAINS } from "@binders/client/lib/devops/domains";
import { dumpAndRunKubeCtl } from "../../lib/k8s";
import { getProductionSecretsFile } from "../../lib/bindersconfig";
import { loadFile } from "../../lib/fs";
import { main } from "../../lib/program";

const AWS_REGION = "eu-central-1"
const AWS_SECRET_NAME = "aws-dns-user-secret"
const AWS_SECRET_KEY = "secret-access-key"
const CERT_MANAGER_VERSION = "v1.7.1"
const EMAIL = "devops@manual.to"
const LETS_ENCRYPT_SERVER_URL = "https://acme-v02.api.letsencrypt.org/directory"
const JETSTACK_REPOSITORY_NAME = "jetstack"
const JETSTACK_REPOSITORY_URL = "https://charts.jetstack.io"
const STATIC_PAGES_SECRET_NAME = "tls-static-pages-secret"


const getTLSSecret = (env: Env) =>
    getTLSSecretName({ isProduction: (env === "production") } as IBindersEnvironment);

async function loadProdSecretConfig() {
    const productionSecretsFile = getProductionSecretsFile()
    return loadFile(productionSecretsFile);
}


async function getAwsAccessKey() {
    const prodSecrets = await loadProdSecretConfig()
    const parsedSecrets = JSON.parse(prodSecrets)
    return parsedSecrets["certManager"]["awsAccessKey"]
}

async function getAwsSecretKey() {
    const prodSecrets = await loadProdSecretConfig()
    const parsedSecrets = JSON.parse(prodSecrets)
    return parsedSecrets["certManager"]["awsSecretKey"]
}


function getDomains(env: Env): string[] {
    if (env === "staging") {
        return ["*.staging.binders.media"]
    }
    if (env === "test") {
        return ["*.staging.binders.media"]
    }
    if (env === "production") {
        return WILDCARD_DOMAINS
    }
    throw new Error("Something goes wrong")
}

function getClusterIssuerName(namespace: string) {
    return `lets-encrypt-cluster-issuer-${namespace}`
}

async function installCertManager(namespace: string) {
    const jestStackRepoExists = await checkIfHelmRepositoryExists(JETSTACK_REPOSITORY_NAME)
    if (!jestStackRepoExists) {
        console.log("Adding Jetstack repository...")
        try {
            addHelmRepo(JETSTACK_REPOSITORY_NAME, JETSTACK_REPOSITORY_URL)
        } catch (error) {
            console.error(`Error during adding Jetstack repo ${error}`, error)
            throw error
        }
        console.log("Repository Jetstack successfully added.")
    }
    await updateHelmRepoCache()
    await runHelmInstall("jetstack/cert-manager", "cert-manager", ".", undefined, namespace, { installCRDs: true }, CERT_MANAGER_VERSION)
}

async function createAWSSecret(namespace: string) {
    const value = await getAwsSecretKey()
    const secret = await getK8SSecret(AWS_SECRET_NAME, namespace)
    if (secret === undefined) {
        try {
            console.log("Creating AWS secret for acme user...")
            await createSecret(AWS_SECRET_NAME, {
                [AWS_SECRET_KEY]: value
            }, namespace)

        } catch (error) {
            console.error(`Error during creating AWS secret: ${error}`, error)
            throw error
        }
    }
}

async function createrClusterIssuerResource(namespace: string, env: Env) {
    const name = getClusterIssuerName(namespace)
    const accessKeyID = await getAwsAccessKey()
    const dnsZones = [...getDomains(env), ...STATIC_PAGE_DOMAINS]
    const clusterIssuer: unknown = {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: {
            name,
            namespace
        },
        spec: {
            acme: {
                server: LETS_ENCRYPT_SERVER_URL,
                email: EMAIL,
                privateKeySecretRef: {
                    name,
                },
                solvers: [{
                    selector: {
                        dnsZones
                    },
                    dns01: {
                        route53: {
                            region: AWS_REGION,
                            accessKeyID,
                            secretAccessKeySecretRef: {
                                name: AWS_SECRET_NAME,
                                key: AWS_SECRET_KEY
                            }
                        }
                    }
                }]
            }

        }
    }
    await dumpAndRunKubeCtl(clusterIssuer, "cert-manager-cluster-issuer.yaml", false)
}

function getCertificateName(namespace: string): string {
    return `lets-encrypt-certificate-${namespace}`
}

async function createCertificateResource(environment: Env, namespace: string, dnsNames: string[], secretName: string, suffix?: string) {
    let name = getCertificateName(namespace)

    if (suffix) {
        name = name.concat(`-${suffix}`)
    }

    const certification: unknown = {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
            name,
            namespace,
            annotations: getCertificateAnnotations(environment)
        },
        spec: {
            secretName,
            duration: "2160h", // 90d
            renewBefore: "720h", // 30d
            issuerRef: {
                name: getClusterIssuerName(namespace),
                kind: "ClusterIssuer",
            },
            dnsNames,
            secretTemplate: {
                annotations: getTLSSecretAnnotations(environment === "production")
            }
        }
    }
    await dumpAndRunKubeCtl(certification, `cert-manager-certificate-${secretName}.yaml`, false)
}

function getCertificateAnnotations(env: Env) {
    if (env === "staging") {
        return {
            "cert-manager.io/disable-auto-renew": "true"
        }
    }
    return {}
}

function getTLSSecretAnnotations(isProduction: boolean) {
    const annotations = {
        "reflector.v1.k8s.emberstack.com/reflection-allowed": "true",
        "reflector.v1.k8s.emberstack.com/reflection-auto-enabled": "true"
    }
    if (isProduction) {
        const allowedNamepsaces = "production,monitoring"
        annotations["reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces"] = allowedNamepsaces
        annotations["reflector.v1.k8s.emberstack.com/reflection-auto-namespaces"] = allowedNamepsaces
    }

    return annotations
}

interface CertManagerOptions {
    namespace: string
    env: string
    reissueForStaging: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "Namespace in which cert-manager will be deployed",
            kind: OptionType.STRING,
            required: true,
        },
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (staging or production)",
            required: true
        },
        reissueForStaging: {
            long: "reissueForStaging",
            short: "r",
            description: "It will trigger reissue certificate flow for staging env",
            kind: OptionType.BOOLEAN,
            default: false
        }

    }
    const parser = new CommandLineParser("CertManager", programDefinition)
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as CertManagerOptions
}

function parseEnv(envi: string): Env {
    if (envi === "staging") {
        return "staging"
    }
    if (envi === "production") {
        return "production"
    }
    throw new Error("Unknown environment")
}

async function deleteCetificate(certificateName: string) {
    const args = ["delete", "certificate", certificateName]
    await buildAndRunCommand(() => buildKubeCtlCommand(args))
}

async function initializeCertManagerAndCreateCertificate(environment: Env, namespace: string) {
    await installCertManager(namespace)
    await createAWSSecret(namespace)
    await createrClusterIssuerResource(namespace, environment)
    // create Certificate resource for staging/production env
    const domains = getDomains(environment)
    const secretName = getTLSSecret(environment)
    await createCertificateResource(environment, namespace, domains, secretName)
    //create Certificate resource for static websistes
    if (environment === "production") {
        await createCertificateResource(environment, namespace, STATIC_PAGE_DOMAINS, STATIC_PAGES_SECRET_NAME, "static-pages")
    }
}

async function reissueCertificateForStaging(environment: Env, namespace: string) {
    if (environment === "staging") {
        const domains = getDomains(environment)
        const secretName = getTLSSecret(environment)
        await deleteCetificate(getCertificateName(namespace))
        await createCertificateResource(environment, namespace, domains, secretName)
    }
}

main(async () => {
    const { env, namespace, reissueForStaging } = getOptions()
    const environment = parseEnv(env)
    if (reissueForStaging) {
        await reissueCertificateForStaging(environment, namespace)
    } else {
        await initializeCertManagerAndCreateCertificate(environment, namespace)
    }
})