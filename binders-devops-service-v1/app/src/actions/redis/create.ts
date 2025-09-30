import * as fs from "fs";
import {
    addHelmRepo,
    checkIfHelmRepositoryExists,
    runHelmInstall,
    updateHelmRepoCache
} from "../helm/install";
import { dumpYaml } from "../../lib/yaml";
import { getStorageClassForCluster } from "../aks/cluster";
import log from "../../lib/logging";

export interface ICreateRedisClusterOptions {
    aksClusterName: string;
    namespace: string;
}

const createBitnamiChartValuesFile = async (k8sClusterName: string) => {
    const redisVersion = "7.2.5"
    const exporterVersion = "1.45.0"
    const storageClass = getStorageClassForCluster(k8sClusterName)
    const commonConfig = [
        "maxmemory 1024mb",
        "maxmemory-policy noeviction",
        "save 900 1"
    ]
    const sentinelConfiguration = [
        "sentinel resolve-hostnames yes",
        "sentinel announce-hostnames yes"
    ]
    const configObject = {
        "global.storageClass": storageClass,
        auth: {
            enabled: false,
            sentinel: false
        },
        image: {
            tag: redisVersion
        },
        commonConfiguration: commonConfig.join("\n"),
        sentinel: {
            configuration: sentinelConfiguration.join("\n"),
            enabled: true,
            image: {
                tag: redisVersion
            }
        },
        metrics: {
            enabled: true,
            image: {
                tag: exporterVersion
            }
        }
    };
    const path = "/tmp/redis-config.yaml";
    await dumpYaml(configObject, path);
    return path;
};

const addBitnamiHelmRepository = async () => {
    const BITNAMI_REPOSITORY_NAME = "bitnami"
    const BITNAMI_REPOSITORY_URL = "https://charts.bitnami.com/bitnami"
    const bitnamiRepoExists = await checkIfHelmRepositoryExists(BITNAMI_REPOSITORY_NAME)
    if (!bitnamiRepoExists) {
        log("Adding bitnami repository...")
        try {
            await addHelmRepo(BITNAMI_REPOSITORY_NAME, BITNAMI_REPOSITORY_URL)
        } catch (error) {
            log(`Error during adding bitnami repo ${error}`, error)
            throw error
        }
        log("Repository bitnami successfully added.")
    }
    await updateHelmRepoCache()
}

export const createBitnamiRedisCluster = async (k8sClusterName: string, namespace: string): Promise<void> => {
    const valuesFilePath = await createBitnamiChartValuesFile(k8sClusterName);
    const releaseName = "redis"
    await addBitnamiHelmRepository()
    const redisBitnamiChartName = "bitnami/redis";
    const chartVersion = "17.3.11";
    await runHelmInstall(redisBitnamiChartName, releaseName, ".", valuesFilePath, namespace, undefined, chartVersion);
    fs.unlinkSync(valuesFilePath);
}


export function getSentinels(namespace: string): { host: string, port: number }[] {
    const toRedisHost = (namespace: string, index: number) => `redis-node-${index}.redis-headless.${namespace}.svc.cluster.local`
    return [0, 1, 2].map(index => ({
        host: toRedisHost(namespace, index),
        port: 26379
    }))
}