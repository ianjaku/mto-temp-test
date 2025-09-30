import {
    BindersConfig,
    buildBindersPreprodConfig,
    buildBindersProductionConfig,
    buildBindersStagingConfig,
    loadStagingSecrets
} from "../../../lib/bindersconfig";
import {
    BindersDeploymentStatus,
    MINIMAL_STAGING_RESOURCE_LIMITS,
    STAGING_RESOURCE_LIMITS
} from "../../../lib/bindersdeployment";
import { BuildBlueprint, TEMPORARY_SERVICE_EXCLUSION_LIST } from "../../../lib/pipeline";
import {
    DeployPlan,
    IBindersEnvironment,
    PREPROD_NAMESPACE,
    PRODUCTION_NAMESPACE,
    createBindersConfigSecret,
    defaultPodReplicas,
    dumpK8sYaml,
    getNamespace,
    isProductionCluster,
    setupRedirectCodeForNginxIngressController,
    toHostConfig,
    toServicePodSelectorLabel
} from "../../../lib/bindersenvironment";
import { ElasticCompatibilityMode, createEckK8sResources } from "../../../lib/eck";
import { HELM_STAGING_MONGO_DIR, HELM_STAGING_REDIS_DIR, } from "../../../lib/helm";
import {
    MONGO_ADMIN_LOGIN,
    createMongoUsersFromSecrets,
    extractAdminCredentials
} from "../../../actions/mongo/user";
import { buildAndRunCommand, buildKubeCtlCommand } from "../../../lib/commands";
import { cleanServiceDeploy, getDeployments } from "../../../actions/bindersenv/deployment";
import { createK8SNamespace, deleteK8SNamespace } from "../../../actions/k8s/namespaces";
import { getFlag, withLDClient } from "../../../lib/launchDarkly";
import { getTLSSecretName, verifySecretExists } from "../../../actions/k8s/secrets";
import { sequential, sleep } from "../../../lib/promises";
import {
    toApiAgicIngress,
    toEditorAgicIngress,
    toIngress,
    toReaderAgicIngress,
    toWildcardEditorAgicIngress
} from "../../../lib/k8s/ingress";
import { MONGO_RELEASE_NAME } from "../../../actions/helm/config";
import { dumpFile } from "../../../lib/fs";
import fetch from "node-fetch";
import { getSecretNameFromBranch } from "../../../lib/secrets";
import { getServiceDir } from "../../../config/services";
import { listPods } from "../../../actions/k8s/pods";
import { log } from "../../../lib/logging";
import { maybeInstallEckOperator } from "../../../actions/elastic/eck";
import { minutesToMilliseconds } from "date-fns";
import { runHelmInstall } from "../../../actions/helm/install";
import validateConfig from "../../../lib/validation";
import { waitForMongoPod } from "../../../actions/mongo/k8s";

export const createNamespace = async (env: IBindersEnvironment, recreate: boolean): Promise<void> => {
    const namespace = getNamespace(env);
    try {
        await createK8SNamespace(namespace);
    } catch (err) {
        if (err.output && err.output.indexOf("Error from server (AlreadyExists)") > -1) {
            if (recreate && err.output.indexOf("object is being deleted:") > -1) {
                log("Waiting for namespace to be deleted...");
                await sleep(5000);
                await createNamespace(env, recreate);
            }
            log(`Namespace ${namespace} already exists`);
            if (!recreate) {
                return undefined;
            }
            await deleteK8SNamespace(namespace);
            await createNamespace(env, true);
        }
    }
};

export const createIngress = async (env: IBindersEnvironment): Promise<void> => {
    const ingress = toIngress(env);
    const ingreses = [ingress]
    ingreses.push(toApiAgicIngress(env))
    ingreses.push(toEditorAgicIngress(env))
    ingreses.push(toReaderAgicIngress(env))
    if (env.isProduction) {
        ingreses.push(toWildcardEditorAgicIngress(env))
    }
    const namespace = getNamespace(env);
    const fileContent = ingreses.join("\n---\n");
    const yamlFile = `/tmp/ingress-${namespace}.yaml`;
    await dumpFile(yamlFile, fileContent);
    const args = ["apply", "-f", yamlFile, "--namespace", namespace];
    await buildAndRunCommand(() => buildKubeCtlCommand(args));
}

export const createInfrastructure = async (env: IBindersEnvironment, loadProductionBackup = false): Promise<void> => {
    if (env.isProduction && !env.testProductionMode) {
        return undefined;
    }
    const isMongo6 = true

    const namespace = getNamespace(env);
    await maybeInstallEckOperator()
    const compatibilityMode = await withLDClient<ElasticCompatibilityMode>("staging", env.branch, client => getFlag(client, "elastic-compatibility-mode"))
    const isPreprodEnv = env.isProduction && env.testProductionMode
    const eckConfig = {
        namespace,
        loadProductionBackup,
        isProduction: env.isProduction,
        minimal: env.isMinimal,
        k8sClusterName: env.cluster,
        compatibilityMode,
        isPreprod: isPreprodEnv
    }
    await createEckK8sResources(eckConfig)
    const { memory: { mongo, redis } } = env.isMinimal ? MINIMAL_STAGING_RESOURCE_LIMITS : STAGING_RESOURCE_LIMITS;
    const redisExtraValues = {
        "redis.maxMemory": redis,
        "redis.pdb.enabled": !!env.CI
    }
    const mongoExtraValues = {
        "mongo.maxMemory": mongo,
        "mongo.pdb.enabled": !!env.CI
    }

    if (isMongo6) {
        const secret = await loadStagingSecrets(env.branch)
        mongoExtraValues["mongo.rootUser"] = MONGO_ADMIN_LOGIN
        mongoExtraValues["mongo.rootPassword"] = extractAdminCredentials(secret.mongo.credentials)
    }

    const redisInstallResult = await runHelmInstall(".", namespace, HELM_STAGING_REDIS_DIR, undefined, namespace, redisExtraValues);
    log(redisInstallResult.output)
    const mongoInstallResult = await runHelmInstall(".", MONGO_RELEASE_NAME, HELM_STAGING_MONGO_DIR, undefined, namespace, mongoExtraValues);
    log(mongoInstallResult.output)
};

export const createServices = async (env: IBindersEnvironment, blueprint: BuildBlueprint, allowProdRestore = false): Promise<DeployPlan> => {
    const namespace = getNamespace(env);
    const isProdCluster = isProductionCluster(env);
    const branch = getSecretNameFromBranch(env.branch)
    const stagingConfig = await buildBindersStagingConfig(namespace, branch, allowProdRestore);
    validateConfig(stagingConfig, "staging");
    const productionConfig = await buildBindersProductionConfig(env.cluster, branch);
    validateConfig(productionConfig, "production");
    const preprodConfig = await buildBindersPreprodConfig(branch)

    let config: BindersConfig
    if (env.isProduction && namespace === PRODUCTION_NAMESPACE) {
        config = productionConfig
    } else if (env.isProduction && namespace === PREPROD_NAMESPACE) {
        config = preprodConfig
    } else {
        config = stagingConfig
    }
    await createBindersConfigSecret(config, env.branch, namespace);

    // We want to set up mongo users for staging and preprod env (it belongs to prod cluster)
    if (namespace !== PRODUCTION_NAMESPACE) {
        await waitForMongoPod(namespace)
        await createMongoUsersFromSecrets(stagingConfig.mongo.credentials, namespace)
    }
    const { yamlFile, deployPlan } = await dumpK8sYaml(env, blueprint, config);
    const nginxNamespace = "ingress"
    await setupRedirectCodeForNginxIngressController(isProdCluster, nginxNamespace)
    const args = ["apply", "-f", yamlFile, "--namespace", namespace];
    await buildAndRunCommand(() => buildKubeCtlCommand(args));
    return deployPlan;
};

export const WAIT_FOR_ENVIRONMENT = minutesToMilliseconds(15);

const waitForIngresBackend = async (environment: IBindersEnvironment, timeoutInMs: number): Promise<void> => {
    if (timeoutInMs < 0) {
        throw new Error("Timed out waiting for ingress backends");
    }
    const hostConfig = toHostConfig(environment);
    const servicesToCheck = environment.services
        .filter(spec => !spec.isWorker)
        .filter(spec => !spec.isFrontend && !spec.sharedDeployment)
        .filter(spec => {
            const serviceDir = getServiceDir(spec);
            return TEMPORARY_SERVICE_EXCLUSION_LIST.indexOf(serviceDir) === -1;
        });
    const isOk = await servicesToCheck.reduce(async (reduced, spec): Promise<boolean> => {
        const okSoFar = await reduced;
        if (!okSoFar) {
            return false;
        }
        const path = `/${spec.name}/${spec.version}/fake-url`;
        const uri = `https://${hostConfig.api}${path}`;
        try {
            const response = await fetch(uri, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            const body = await response.text();
            if (body.includes("default backend - 404")) {
                log(`Service ${spec.name} not responding (got default backend)`);
                return false;
            }
            if (response.status === 404 &&
                (
                    body.includes("We cannot find what you are looking for.") ||
                    body.includes(`Cannot GET ${path}`)
                )
            ) {
                log(`Service ${spec.name} is online.`);
                return true;
            }
            if (response.status === 404 && spec.name === "static-pages") {
                log("Static pages is online");
                return true;
            }
            log(`Service ${spec.name} is online, but ingress has not found it yet.`);
            return false;
        } catch (err) {
            log("Failure performing https request: " + err.toString());
            return false;
        }
    }, Promise.resolve(true));
    if (isOk) {
        log("All ingress backends are responding");
        return undefined;
    }
    const period = 5000;
    log(`Ingress backends not yet active, sleeping for ${period / 1000} seconds`);
    await sleep(period);
    return waitForIngresBackend(environment, timeoutInMs - period);
};

export const waitForEnvironment = async (environment: IBindersEnvironment, waitInMs: number, deployPlan: DeployPlan): Promise<void> => {
    if (waitInMs < 0) {
        throw new Error("Timed out waiting for environment.");
    }
    const namespace = getNamespace(environment)
    const pods = await listPods(environment.prefix, namespace);
    const runningPods = pods
        .filter(p =>
            p.status &&
            p.status.conditions &&
            p.status.conditions.find(c => c.type === "Ready" && c.status === "True")
        );

    const servicesToWaitFor = [];
    for (const planKey in deployPlan) {
        const deployPlanItem = deployPlan[planKey];
        if (deployPlanItem.status === BindersDeploymentStatus.UP_TO_DATE) {
            continue;
        }
        const service = environment.services.find(
            s => s.name === deployPlanItem.name && s.version === deployPlanItem.version
        );
        if (service === undefined) {
            throw new Error(`Could not find service ${deployPlanItem.name}-${deployPlanItem.version}`);
        }
        if (service.sharedDeployment ||
            TEMPORARY_SERVICE_EXCLUSION_LIST.indexOf(getServiceDir(service)) !== -1) {
            continue;
        }
        servicesToWaitFor.push(service);
    }

    const podLabels = servicesToWaitFor.map(s => toServicePodSelectorLabel(environment, s));
    const missingServices = podLabels
        .filter((label, i) => {
            const matchingPods = runningPods.filter(pod => pod.metadata.labels.component.startsWith(label));
            const matchingPodCount = matchingPods.length;
            const matchingService = servicesToWaitFor[i];
            const expectedPodCount = matchingService.replicas || defaultPodReplicas(environment);
            if (matchingPodCount < expectedPodCount) {
                log(`Missing pods for ${matchingService.name}-${matchingService.version} \
                    (${matchingPodCount} out of ${expectedPodCount})`);
                return true;
            }
            return false;
        });

    if (missingServices.length === 0) {
        log("All services are up and running");
        if (environment.isProduction) {
            return undefined;
        } else {
            return waitForIngresBackend(environment, minutesToMilliseconds(5));
        }
    } else {
        log(`Missing containers for ${missingServices.length} services`);
        log(missingServices);
        const period = 5000;
        log(`Sleeping for ${period}`);
        await sleep(period);
        return waitForEnvironment(environment, waitInMs - period, deployPlan);
    }
};

export const waitForTlsSecret = async (environment: IBindersEnvironment, timeoutInMs: number): Promise<void> => {
    if (environment.isProduction) {
        return undefined
    }
    if (timeoutInMs < 0) {
        throw new Error("Timed out waiting for tls secret");
    }
    const secretName = getTLSSecretName(environment)
    const namespace = getNamespace(environment)
    const isOk = await verifySecretExists(secretName, namespace)
    if (isOk) {
        log(`${secretName} secret exists in namespace ${namespace}`);
        return undefined
    } else {
        log(`Missing ${secretName} secret in namespace ${namespace}`);
        const period = 5000;
        log(`Sleeping for ${period}`);
        await sleep(period);
        return waitForTlsSecret(environment, timeoutInMs - period)
    }
}

export const cleanOldDeploys = async (env: IBindersEnvironment): Promise<void> => {
    if (env.isProduction) {
        return;
    }
    const namespace = getNamespace(env);
    const deploys = await getDeployments(namespace);
    await sequential(d => cleanServiceDeploy(d, namespace, 0), deploys);
}

export const SERVICES_NOT_TO_DEPLOY = [
    "dashboard",
    "devops",
    "partners",
    "static-pages"
];
