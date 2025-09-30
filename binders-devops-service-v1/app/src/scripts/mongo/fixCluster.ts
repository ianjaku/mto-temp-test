import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { existsSync } from "fs";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { getProductionCluster } from "../../actions/aks/cluster";
import { homedir } from "os";
import { join } from "path";
import { loadJSON } from "../../lib/json";
import { main } from "../../lib/program";

const SCRIPT_IN_CONTAINER = "/tmp/fixClusterHosts.js";
const REPLICA_SET = "mongo-main-service";
const SERVICE_NAME = "mongo-main-service-mongodb-service"

const getMongoHosts = () => ([
    "mongo-main-service-mongod-0",
    "mongo-main-service-mongod-1",
    "mongo-main-service-mongod-2"
]);

const copyScript = async () => {
    const scriptFile = join(
        await getLocalRepositoryRoot(),
        "binders-devops-service-v1", "app", "src", "actions", "mongo", "fixClusterHosts.js"
    );
    await Promise.all(getMongoHosts().map(
        async (host) => {
            const cpArgs = [
                "cp",
                "-n", PRODUCTION_NAMESPACE,
                scriptFile,
                `${host}:/${SCRIPT_IN_CONTAINER}`
            ];
            await buildAndRunCommand(() => buildKubeCtlCommand(cpArgs));
        }
    ));
}

const getMongoCredentials = async () => {
    const file = join(homedir(), ".mongo.secret");
    if (existsSync(file)) {
        const contents = await loadJSON(file);
        if (contents.login && contents.password) {
            return contents;
        }
    }
    const login = process.env["MONGO_LOGIN"];
    const password = process.env["MONGO_PASSWORD"];
    if (login && password) {
        return { login, password };
    }
    throw new Error("Could not determing mongo credentials.");
}

const buildUri = async () => {
    const hosts = getMongoHosts();
    const hostsWithService = hosts.map(h => `${h}.${SERVICE_NAME}`);
    const { login, password } = await getMongoCredentials();
    return `mongodb://${login}:${password}@${hostsWithService.join(",")}/admin?replicaSet=${REPLICA_SET}`;

}
const runScript = async () => {
    const uri = await buildUri();
    const pod = getMongoHosts().shift();
    const mongoExecArgs = [
        "exec", "-it", "-n", PRODUCTION_NAMESPACE, pod,
        "--",
        "mongo", uri, SCRIPT_IN_CONTAINER
    ]
    await buildAndRunCommand(
        () => buildKubeCtlCommand(mongoExecArgs)
    )
}

const doIt = async() => {
    await runGetKubeCtlConfig(getProductionCluster());
    await copyScript();
    await runScript();
}

main(doIt);