import { deletePods, listPods } from "../k8s/pods";
import {
    getClientContainerIds,
    getCommonContainerIds,
    getServiceContainerIds,
    getUiKitContainerIds
} from "./containers";
import { restartContainer, restartContainers } from "../docker/restart";
import { getLogsSinceMessage } from "../docker/logs"
import { log } from "../../lib/logging"
import { sleep } from "../../lib/promises"

const MAX_RESTART_COUNT = 5;
const MAX_WAIT_COUNT = 120;

let lastFailureLine;

const maybeRestartContainer =   async (containerId: string,
    restartPatterns: RegExp[], successPatterns: RegExp[], failurePatterns: RegExp[],
    counters?: {restarts: number, waits: number}): Promise<void> => {

    if (!containerId) {
        throw new Error("Missing container!");
    }
    if (!counters) {
        lastFailureLine = undefined;
        counters = {
            restarts: 0,
            waits: 0
        };
    }
    const logs = await getLogsSinceMessage(containerId, restartPatterns, 500);
    const matchingRegex = (patterns: RegExp[], line: string): RegExp => {
        return patterns.find(trigger => !!line.match(trigger));
    };
    const failureLine = logs.find(line => !!matchingRegex(failurePatterns, line));
    if (failureLine) {
        if (counters.restarts > MAX_RESTART_COUNT) {
            throw new Error(`Restarted container ${containerId} ${MAX_RESTART_COUNT} times, still not ok.`);
        }
        if (lastFailureLine === failureLine) {
            // tslint:disable-next-line
            log(logs);
        }
        lastFailureLine = failureLine;
        log(`Got match on error regex ${failureLine}`);
        log(`Restarting container ${containerId} (${counters.restarts + 1}x)`);
        await restartContainer(containerId);
        await sleep(10000);
        const newRestartCounters = {
            restarts: counters.restarts + 1,
            waits: 0
        };
        return maybeRestartContainer(containerId, restartPatterns, successPatterns, failurePatterns, newRestartCounters);
    }
    const successLine = logs.find(line => !!matchingRegex(successPatterns, line));
    if (successLine) {
        log(`${containerId} is up and running.`);
        return;
    }
    if (counters.waits > MAX_WAIT_COUNT) {
        throw new Error(`Container ${containerId} still not ready.`);
    }
    await sleep(1000);
    const newCounters = {
        restarts: counters.restarts,
        waits: counters.waits + 1
    };
    if (newCounters.waits % 10 === 0) {
        log(`Still waiting for container ${containerId} to become active`);
    }
    return maybeRestartContainer(containerId, restartPatterns, successPatterns, failurePatterns, newCounters);
};

const TSC_START_PATTERNS = [
    /Starting compilation in watch mode/,
];
const TSC_SUCCESS_PATTERNS = [
    /Found 0 errors\. Watching for file changes/,
];
const VOLUME_ERROR_PATTERNS = [
    /ENOENT/,
    /Cannot find module '@binders/,
    /error TS5033: Could not write file/
];
const TSC_ERROR_PATTERNS = [
    /error TS[0-9]+/
];
const NODEMON_START_PATTERNS = [
    /npm run compile/
];
const SERVICE_ERROR_PATTERNS = [
    /code ELIFECYCLE/,
    /app crashed - waiting for file changes/,
    /JavaScript heap out of memory/,
];
const SERVICE_SUCCESS_PATTERNS = [
    /HTTP Server listening on/
];

export const restartClient = async (): Promise<void> => {
    log("Checking client");
    const clientContainerIds = await getClientContainerIds();
    if (clientContainerIds.length > 1) {
        throw new Error("Found multiple client containers...");
    }
    await maybeRestartContainer(clientContainerIds[0],
        TSC_START_PATTERNS,
        TSC_SUCCESS_PATTERNS,
        [...VOLUME_ERROR_PATTERNS, ...TSC_ERROR_PATTERNS]
    );
};

export const restartUiKit = async (): Promise<void> => {
    log("Checking uikit");
    const uiKitContainerIds = await getUiKitContainerIds();
    if (uiKitContainerIds.length > 1) {
        throw new Error("Found multiple uikit containers...");
    }
    await maybeRestartContainer(uiKitContainerIds[0],
        TSC_START_PATTERNS,
        TSC_SUCCESS_PATTERNS,
        [...VOLUME_ERROR_PATTERNS, ...TSC_ERROR_PATTERNS]
    );
};

export const restartCommon = async (): Promise<void> => {
    log("Checking common");
    const commonContainerIds = await getCommonContainerIds();
    if (commonContainerIds.length > 1) {
        throw new Error("Found multiple common containers...");
    }
    await maybeRestartContainer(commonContainerIds[0],
        TSC_START_PATTERNS,
        TSC_SUCCESS_PATTERNS,
        [...VOLUME_ERROR_PATTERNS, ...TSC_ERROR_PATTERNS]
    );
};

export interface ServiceRuntimeInfo {
    serviceName: string;
    containerId?: string;
    status: "error" | "running" | "waiting";
    restartIteration: number;
    waitIteration: number;
}

const fillContainerIds = async (infos: ServiceRuntimeInfo[]): Promise<void> => {
    const result = [];
    for (const info of infos) {
        if (info.status === "running" || (info.containerId && info.containerId.length > 0)) {
            result.push(info);
        }
        const serviceContainerIds = await getServiceContainerIds(info.serviceName);
        if (serviceContainerIds.length > 1) {
            throw new Error(`Found multiple containers for service ${info.serviceName}...`);
        }
        info.containerId = serviceContainerIds[0];
    }
}

const processWaiting = async (infos: ServiceRuntimeInfo[]): Promise<ServiceRuntimeInfo[]> => {
    await fillContainerIds(infos);
    const result = [];
    const allLogs = await Promise.all(
        infos.map(async info => {
            if (info.status === "waiting" && info.containerId !== undefined) {
                const lineCount = Math.min(1000 * info.waitIteration, 50000);
                if (info.containerId) {
                    return getLogsSinceMessage(info.containerId, NODEMON_START_PATTERNS, lineCount);
                } else {
                    return [];
                }
            } else {
                return Promise.resolve(undefined);
            }
        })
    );
    for (const infoIndex in infos) {
        const info = infos[infoIndex];
        const logs = allLogs[infoIndex];
        if (info.status !== "waiting") {
            result.push(info);
            continue;
        }
        if (info.containerId.length === 0) {
            log(`Could not find container for service ${info.serviceName}`)
            result.push(info);
            continue;
        }

        const matchingRegex = (patterns: RegExp[], line: string): RegExp => {
            return patterns.find(trigger => !!line.match(trigger));
        };
        const failurePatterns = [
            ...VOLUME_ERROR_PATTERNS,
            ...TSC_ERROR_PATTERNS,
            ...SERVICE_ERROR_PATTERNS
        ];
        const failureLine = logs.find(line => !!matchingRegex(failurePatterns, line));
        if (failureLine) {
            log(`Found an error in logs for ${info.serviceName}. Going to restart it.`);
            log(" - ", failureLine);
            result.push({
                ...info,
                status: "error",
            });
            continue;
        }
        const successLine = logs.find(line => !!matchingRegex(SERVICE_SUCCESS_PATTERNS, line));
        if (successLine) {
            log(`Service ${info.serviceName} is up and running`);
            result.push({
                ...info,
                status: "running",
            });
            continue;
        }
        const lineCount = Math.min(1000 * info.waitIteration, 50000);
        log(`Waiting for service ${info.serviceName} to become active (checked last ${lineCount} lines)`);
        result.push({
            ...info,
            waitIteration: info.waitIteration + 1
        });
    }
    return result;
}

const processErrors = async (infos: ServiceRuntimeInfo[]): Promise<ServiceRuntimeInfo[]> => {
    const result: ServiceRuntimeInfo[] = [];
    const servicesToRestart = [];
    const containersToRestart = [];
    for (const info of infos) {
        if (info.status !== "error") {
            result.push(info);
            continue;
        }
        servicesToRestart.push(info.serviceName);
        containersToRestart.push(info.containerId);
        result.push({
            ...info,
            restartIteration: info.restartIteration,
            status: "waiting",
            waitIteration: 1
        });
    }
    if (servicesToRestart.length > 0) {
        log(`Going to restart containers ${servicesToRestart.join(", ")}`);
        await restartContainers(containersToRestart);
    }
    return result;
}
export const restartServicesWithInfo = async (infos: ServiceRuntimeInfo[]): Promise<void> => {
    const inNeedOfAttention = infos.filter(i => i.status !== "running");
    if (inNeedOfAttention.length === 0) {
        return;
    }
    const exceedingRestartCount = infos.filter(i => i.restartIteration > MAX_RESTART_COUNT);
    if (exceedingRestartCount.length > 0) {
        log(`Aborting. Services ${exceedingRestartCount.map(i => i.serviceName).join(", ")} after ${MAX_RESTART_COUNT} restarts.`);
        throw new Error("TooManyRestarts");
    }
    const updatedWaiting = await processWaiting(infos);
    const stillNotRunning = updatedWaiting.filter(i => i.status !== "running");
    if (stillNotRunning.length === 0) {
        return;
    }
    log(`Still waiting for ${stillNotRunning.length} services`);
    const updatedInfos = await processErrors(updatedWaiting);
    log("Sleeping for 5s");
    await sleep(5000);
    return restartServicesWithInfo(updatedInfos);
}

export async function restartElastic(): Promise<void> {
    const pods = await listPods("binders-es-master", "develop");
    const podsToDelete = [];
    for (const pod of pods) {
        const initContainerStatuses = pod?.status?.initContainerStatuses || [];
        const crashing = initContainerStatuses.find(s => s?.state?.waiting?.reason === "CrashLoopBackOff");
        if (crashing) {
            podsToDelete.push(pod);
        }
    }
    if (podsToDelete.length > 0) {
        const podNames = podsToDelete.map(p => p.metadata.name);
        log(`Deleting elastic pod(s) '${podNames.join("', '")}'`);
        await deletePods(podNames, { namespace: "develop" });
        await sleep(1000);
        return restartElastic();
    } else {
        log("Elastic is up and running");
    }
}