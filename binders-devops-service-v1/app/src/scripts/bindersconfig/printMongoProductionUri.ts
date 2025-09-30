/* eslint-disable no-console */
import { buildBindersProductionConfig } from "../../lib/bindersconfig";
import { buildUri } from "../../actions/mongo/config";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";

const doIt = async () => {
    const config = await buildBindersProductionConfig(getProductionCluster());
    const clusterConfig = config.mongo.clusters.main;
    const hosts = clusterConfig.instances;
    const replicaSet = clusterConfig.replicaSet;
    const password = process.env.MONGO_READALL_PASSWORD;
    if (!password) {
        console.log("Please add readonly user password to the environment.");
        process.exit(1);
    }
    const credentials = {
        login: "readAll",
        password
    }
    console.log(buildUri(hosts, replicaSet, credentials));
}

main(doIt);