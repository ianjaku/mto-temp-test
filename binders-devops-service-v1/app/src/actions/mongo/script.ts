import { MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME } from "../helm/config";
import { copyFile, listPods } from "../k8s/pods";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { executeMongoScript } from "./mongosh";
import { runExec } from "../k8s/exec";



const getMongoPods = async (namespace): Promise<string[]> => {
    const helmReleaseName = MONGO_RELEASE_NAME
    const pods = await listPods(helmReleaseName, namespace);
    if (pods.length < 1) {
        throw new Error(`Could not find running mongo pods for (${helmReleaseName}`);
    }
    return pods.map(({ metadata }) => metadata.name);
};

export async function isMongoshAvailable(mongoPod: string, namespace: string): Promise<boolean> {
    try {
        await runExec(mongoPod, ["mongosh", "--version"].join(" "), { namespace })
    } catch (error) {
        return Promise.resolve(false)
    }
    return Promise.resolve(true)
}

export interface RunMongoScriptConfig {
    adminLogin?: string
    adminPassword?: string
    authenticated: boolean
    contents?: string
    location?: string
    forceReplicaSet?: boolean
    namespace: string
}
export const runMongoScriptInPod = async (config: RunMongoScriptConfig): Promise<unknown[]> => {
    const { adminLogin, adminPassword, authenticated, forceReplicaSet, location, namespace } = config
    const mongoPods = await getMongoPods(namespace);
    const replicaSetName = resolveReplicaSet(forceReplicaSet, namespace)
    const pods = authenticated ? mongoPods : [mongoPods.shift()]
    const results = []
    for (const mongoPod of pods) {
        await copyFile(location, `${mongoPod}:${location}`, namespace);
        if (await isMongoshAvailable(mongoPod, namespace)) {
            await executeMongoScript(mongoPod, namespace, adminLogin, adminPassword, location)
        } else {
            results.push(execCommandInMongo(adminLogin, adminPassword, authenticated, mongoPod, namespace, replicaSetName, location))
        }
    }
    return Promise.all(results);
};

function execCommandInMongo(adminLogin: string, adminPassword: string, authenticated: boolean, mongoPod: string, namespace: string, replicaSetName: string, location: string) {
    const commandParts = ["mongo"];
    if (replicaSetName) {
        commandParts.push("--host", `${replicaSetName}/localhost`);
    }
    if (authenticated) {
        commandParts.push(`-u ${adminLogin} -p ${adminPassword} --authenticationDatabase "admin"`);
    }
    commandParts.push(` < ${location}`);
    const command = commandParts.join(" ");
    return runExec(mongoPod, command, { namespace })
}


function resolveReplicaSet(forceReplicaSet: boolean, namespace: string): string | undefined {
    return namespace === PRODUCTION_NAMESPACE || forceReplicaSet ? MONGO_REPLICASET_NAME : undefined
}
