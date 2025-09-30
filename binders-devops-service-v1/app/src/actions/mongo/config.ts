/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { HelmReleaseType, getHelmReleaseName } from "../helm/config";
import { getMongoPodName, getMongoServiceName } from "./k8s";
import { createMongoSuperAdmin } from "./user";
import { dumpFile } from "../../lib/fs";
import log from "../../lib/logging";
import { runMongoScriptInPod } from "./script";

export const getHelmMongoReleaseName = (mongoClusterName: string, releaseType: HelmReleaseType) => (
    getHelmReleaseName("mongo", mongoClusterName, releaseType)
);


/*
rs.initiate({_id: "mongo-main-service", version: 1, members: [
    { _id: 0, host : "mongo-main-service-mongod-0.mongo-main-service-mongodb-service:27017" },
    { _id: 1, host : "mongo-main-service-mongod-1.mongo-main-service-mongodb-service:27017" },
    { _id: 2, host : "mongo-main-service-mongod-2.mongo-main-service-mongodb-service:27017" }
]});
*/
const setupReplicaSet = async (namespace: string, replicaSetName: string, serviceName: string, pods: string[]) => {
    log("Initializing replica set");
    const buildRsHostRow = (pod, i) => `{ _id: ${i}, host: "${pod}.${serviceName}:27017" }`;
    const rows = pods.map(buildRsHostRow);
    const script = `
    result = rs.initiate({_id: "${replicaSetName}", version: 1, members: [
        ${rows.join(",\n")}
    ]});
    if (!result.ok) {
        printjson(result);
        quit(1);
    }
    `;
    const location = `/tmp/rsInit-${replicaSetName}.js`;
    await dumpFile(location, script);
    return runMongoScriptInPod({
        authenticated: false,
        namespace,
        location
    })
};

export const getAdminCredentials = () => {
    const login = process.env.MONGO_ADMIN_LOGIN;
    const password = process.env.MONGO_ADMIN_PASSWORD;
    const errors = [];
    if (login === undefined) {
        errors.push("MONGO_ADMIN_LOGIN not set");
    }
    if (password === undefined) {
        errors.push("MONGO_ADMIN_PASSWORD not set");
    }
    if (errors.length > 0) {
        log(`Missing environment variables\n${errors.join("\n")}`);
        process.exit(1);
    }
    return { login, password };
};


export const initialConfiguration = async (replicaSetName: string, namespace: string, clusterSize: number) => {
    const indices = Array.from(Array(clusterSize).keys());
    const serviceName = getMongoServiceName();
    const pods = indices.map(getMongoPodName);
    if (clusterSize > 1) {
        await setupReplicaSet(namespace, replicaSetName, serviceName, pods);
    }
    await createMongoSuperAdmin(namespace, undefined, true);
};

export interface HostWithPort {
    host: string;
    port: number;
}

export interface LoginAndPassword {
    login: string;
    password: string;
}

export const buildUri = (hosts: HostWithPort[], replicaSet?: string, credentials?: LoginAndPassword): string => {
    const credentialsString = credentials ?
        `${credentials.login}:${credentials.password}@` :
        "";

    const hostsString = hosts
        .map(({ host, port }) => `${host}:${port}`)
        .join(",");
    const suffix = replicaSet ?
        `?replicaSet=${replicaSet}` :
        "";
    return `mongodb://${credentialsString}${hostsString}/${suffix}`;
};