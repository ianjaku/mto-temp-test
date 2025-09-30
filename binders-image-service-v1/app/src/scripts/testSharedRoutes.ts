/* eslint-disable no-console */
import { BackendImageServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();
const getImageServiceClient = () => BackendImageServiceClient.fromConfig(config, "backtrack-readsession-ids");

let globalMax = 0;
let globalBandwidthMin = 1024 * 1024 * 1024;

const getOptions = () => {
    return {
        threadCount: process.argv[2] ? parseInt(process.argv[2]) : 0,
        iterationCount: process.argv[3] ? parseInt(process.argv[3], 10) : 1000,
        sampleSize: process.argv[4] ? parseInt(process.argv[4], 10) : (16 * 1024)
    };
};

const { iterationCount, sampleSize, threadCount } = getOptions();
if (threadCount === 0) {
    throw new Error("Usage: <SCRIPT_NAME> <THREAD_COUNT> <?ITERATION_COUNT = 1000> <?SAMPLE_SIZE = 16*1024>");
}

console.log(getOptions());

const thread = async (tId) => {
    const client = await getImageServiceClient();
    let localMax = 0;
    let localBandwidthMin = 1024 * 1024 * 1024;
    for (let i = 0;  i < iterationCount; i++) {
        const report = await client.bandWidthReport( sampleSize );
        const { elapsed, mbytes } = report;
        if (elapsed > localMax) {
            localMax = elapsed;
            localBandwidthMin = mbytes;
            if (localMax > globalMax) {
                globalBandwidthMin = localBandwidthMin;
                globalMax = localMax;
            }
        }
    }
    console.log(`[${tId}] Max: ${localMax}ms`);
    console.log(`[${tId}] MBytes/s: ${localBandwidthMin}`);
};

const doIt = async () => {
    const promises = [];
    for (let i = 0; i < threadCount; i++) {
        promises.push(thread(i));
    }
    await Promise.all(promises);
    console.log(`\n\n\nGLOBAL MAX: ${globalMax}ms`);
    console.log(`MBytes/s: ${globalBandwidthMin}\n\n`);
};

doIt()
    .then(
        () => {
            console.log("All done!");
            process.exit(0);
        },
        err => {
            console.log(err);
            process.exit(1);
        }
    );