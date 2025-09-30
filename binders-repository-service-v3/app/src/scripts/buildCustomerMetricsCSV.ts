/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import { ALLOWED_MODES, DEFAULT_MODE } from "../repositoryservice/customerMetrics/constants";
import {
    BackendAccountServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Mode } from "../repositoryservice/customerMetrics/contract";
import buildCustomerMetrics from "../repositoryservice/customerMetrics";

const scriptName = "build-customers-metrics-csv";
const outFileDir = "/tmp/useractions";
const outFileName = "customer-metrics.csv";

function getOptions(): { mode: Mode } {
    const modeArgPos = process.argv.indexOf("--mode");
    const mArgPos = process.argv.indexOf("-m");

    let modePos;
    if (modeArgPos !== -1) {
        modePos = modeArgPos + 1;
    } else if (mArgPos !== -1) {
        modePos = mArgPos + 1;
    } else {
        modePos = -1;
    }

    const mode = modePos === -1 ? DEFAULT_MODE : process.argv[modePos];
    if (mode && !(ALLOWED_MODES.includes(mode as Mode))) {
        console.error(`Unknown mode: ${mode}`);
        process.exit(1);
    }
    return {
        mode: mode as Mode,
    };
}

type FsInfo = {
    close: () => unknown,
    addLine: (line: string) => unknown,
    write: () => unknown,

}

export function createOutputFileStream(): FsInfo {
    const fullPath = path.join(outFileDir, outFileName);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
    }
    fs.mkdirSync(outFileDir, { recursive: true });
    fs.appendFileSync(fullPath, "");
    const stream = fs.createWriteStream(fullPath);

    const lines = [];

    return {
        close: () => stream.end(),
        addLine: (line: string) => lines.push(line),
        write: () => stream.write(lines.join("\n"), "utf-8"),
    }
}

async function buildCustomerMetricsCSV() {
    const { mode } = getOptions();
    const config = BindersConfig.get();
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, scriptName);
    const trackingServiceClient = await BackendTrackingServiceClient.fromConfig(config, scriptName);

    const outputFileStream = createOutputFileStream();

    const csv = await buildCustomerMetrics(accountServiceClient, trackingServiceClient, mode);
    outputFileStream.addLine(csv);

    outputFileStream.write();
    outputFileStream.close();
}

buildCustomerMetricsCSV()
    .then(() => {
        console.log("\nAll done!")
        process.exit(0)
    })
    .catch((err) => {
        console.log("\nFailed.\n")
        console.error(err);
        process.exit(1);
    })
