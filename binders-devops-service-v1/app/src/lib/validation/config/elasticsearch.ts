import { IValidationEnv, strict, typeHost, typeStrictStruct, typeVersion } from "../types";

import t = require("tcomb");

const elasticSearchClusters = [
    "binders",
    "logevents",
    "useractions",
];

const clusterDev = t.struct({
    apiVersion: typeVersion,
    host: typeHost,
});

const newCluster = t.struct({
    apiVersion: typeVersion,
    host: typeHost,
    httpAuth: t.String
}, strict);

const oldCluster = t.struct({
    apiVersion: typeVersion,
    hosts: t.list(typeHost)
}, strict);

const devClusters = typeStrictStruct(elasticSearchClusters, clusterDev)

const clusters = t.struct({
    binders: newCluster,
    logevents: oldCluster,
    useractions: newCluster
}, strict);

const environmentClusters = {
    local: devClusters,
    production: clusters,
    staging: devClusters,
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (env: IValidationEnv) => t.struct({
    clusters: environmentClusters[env],
}, strict);