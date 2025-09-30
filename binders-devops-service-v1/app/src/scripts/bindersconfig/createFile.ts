import { buildBindersStagingConfig } from "../../lib/bindersconfig";
import { dumpJSON } from "../../lib/json";
import { main } from "../../lib/program";

const getOptions = () => {
    return {
        envName: "pipeline-experiment",
        outputFile: "/tmp/dump.json",
        branch: "develop"
    };
};

const runIt = async () => {
    const { branch, envName, outputFile } = getOptions();
    const bindersConfig = await buildBindersStagingConfig (envName, branch); // envName);
    await dumpJSON(bindersConfig, outputFile);
    // const creds = await getMongoCredentials("production");
    // console.log(creds);
};

main( runIt );
