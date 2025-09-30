import {
    buildAndRunCommand,
    buildDockerCommand,
    buildKubeCtlCommand,
    buildXdgOpenCommand,
    runCommand
} from "../../lib/commands";
import { dumpFile, loadFile } from "../../lib/fs";
import { getElasticUserPassword } from "../../lib/eck";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { restartContainer } from "../../actions/docker/restart";
import { sleep } from "../../lib/promises";
import { tmpdir } from "os";

const HOSTNAME = "local-eck-cluster";

async function getCerebroContainerId(includeStopped = false) {
    const extraArgs = includeStopped ? [ "-a" ] : [];
    const args = ["ps", "-q", ...extraArgs, "--filter", "ancestor=lmenezes/cerebro"]
    const { output } = await buildAndRunCommand(() => buildDockerCommand(args), { mute: true })
    return output
        .split("\n")
        .filter(l => l !== "")
        .shift();
}

const ensureCerebroContainerIsRunning = async (): Promise<string> => {
    const runningOrStoppedCerbroId = await getCerebroContainerId(true);
    if (runningOrStoppedCerbroId !== undefined) {
        log("Cerebro container exists.");
        return runningOrStoppedCerbroId;
    }
    log("Starting new cerebro container")
    const args = ["run", "-d", "-p", "9000:9000", "lmenezes/cerebro"];
    await runCommand("docker", args, { mute: true });
    await sleep(3000);
    return getCerebroContainerId();
}

const getElasticClusterIp = async (elasticServiceName = "binders-es-http") => {
    const args = ["get", "svc", elasticServiceName, "--namespace", "develop"]
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(args), { mute: true })
    const serviceOutput = output.split("\n")
    if (serviceOutput.length > 1) {
        const [ , serviceInfo] = serviceOutput
        const [ , , clusterIp] = serviceInfo.split(/[ ,]+/);
        return clusterIp
    }
    throw new Error("Can't get elastic service cluster ip")
}

const openBrowser = async () => {
    log("Opening browser tab.");
    const cerebroUrl = `http://localhost:9000/#!/overview?host=${HOSTNAME}`
    await buildAndRunCommand(() => buildXdgOpenCommand([cerebroUrl]))
}

async function setupApplicationConfigFile(cerebroPod: string, elasticIp: string, elasticPassword: string) {
    log("Updating cerebro application config")
    const cfgFileLocationLocal = tmpdir() + "/application.conf";
    const cfgFileLocationInPod = `${cerebroPod}:/opt/cerebro/conf/application.conf`;
    await runCommand("docker", ["cp", cfgFileLocationInPod, cfgFileLocationLocal]);
    const configContents = await loadFile(cfgFileLocationLocal);
    const configLines = configContents.trimEnd().split("\n");
    let lastLine;
    do {
        lastLine = configLines.pop();
        if (configLines.length === 0) {
            throw new Error("Missed hosts section!");
        }
    } while (lastLine.indexOf("hosts") !== 0);
    configLines.push(
        lastLine,
        "  {",
        `    host = "http://${elasticIp}:9200"`,
        `    name = "${HOSTNAME}"`,
        "    auth = {",
        "      username = \"elastic\"",
        `      password = "${elasticPassword}"`,
        "    }",
        "  }",
        "]",
        ""
    );
    const newContents = configLines.join("\n");
    if (newContents !== configContents) {
        log("Cerebro config changed. Re-applying.");
        await dumpFile(cfgFileLocationLocal, configLines.join("\n"));
        await runCommand("docker", ["cp", cfgFileLocationLocal, cfgFileLocationInPod]);
        return true;
    } else {
        log("Cerebro config is unmodified");
        return false;
    }
}

const doIt = async () => {
    const elasticPassword = await getElasticUserPassword("develop");
    const clusterIp = await getElasticClusterIp();
    const cerebroId = await ensureCerebroContainerIsRunning();
    if (cerebroId === undefined) {
        throw new Error("Cerebro should be running.");
    }
    const changed = await setupApplicationConfigFile(cerebroId, clusterIp, elasticPassword);
    if (changed) {
        log("Restarting container");
        await restartContainer(cerebroId);
        await sleep(3000);
    }
    const runningCerebroId = await getCerebroContainerId();
    if (! runningCerebroId ) {
        log("Starting stopped cerbro.");
        await runCommand("docker", [ "start", cerebroId ], { mute: true });
        await sleep(3000);
    }
    await openBrowser();
};

main(doIt);

