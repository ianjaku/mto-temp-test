import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { MONGO_RELEASE_NAME } from "../helm/config";
import { log } from "console";
import { sleep } from "../../lib/promises";

type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown"

async function isPodRunning(namespace: string, pod: string): Promise<boolean> {
    //kne get pod mongo-main-service-mongod-0 -o=custom-columns=:status.phase --no-headers=true
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(["get", "pod", pod, "-n", namespace, "--no-headers=true", "-o=custom-columns=:status.phase"]))
    return output.trim() as PodPhase === "Running"
}

async function isMongoDBReady(namespace: string, pod: string): Promise<boolean> {
    const command = [
        "exec",
        pod,
        "-n",
        namespace,
        "--",
        "sh",
        "-c",
        "echo \"db.runCommand({ ping: 1 })\" | mongosh"
    ];

    try {
        const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(command));
        const lines = output.split("\n");
        const isReady = lines.some(line => line.includes("{ ok: 1 }"));
        return isReady;
    } catch (err) {
        log(err)
        return false;
    }
}

export function getMongoPodName(index = 0): string {
    return `${MONGO_RELEASE_NAME}-mongod-${index}`
}

export function getMongoServiceName(): string {
    return `${MONGO_RELEASE_NAME}-mongodb-service`
}

export async function waitForMongoPod(namespace: string, pod = getMongoPodName()): Promise<void> {
    const ok = await isPodRunning(namespace, pod)
    if (!ok) {
        log(`Mongo pod ${pod} in namespace ${namespace} is not in running state yet...`)
        await sleep(5000)
        await waitForMongoPod(namespace, pod)
        return;
    }

    const isMongoReady = await isMongoDBReady(namespace, pod)
    if (!isMongoReady) {
        log(`Mongo pod ${pod} in namespace ${namespace} is not in ready yet...`)
        await sleep(5000)
        await waitForMongoPod(namespace, pod)
        return;
    }
}

type sourceOrTarget = "source" | "target"
const sourcreOrTarget = (source: boolean): sourceOrTarget => source ? "source" : "target"

export function generateMongoLoadBalancerServiceName(index: number, source: boolean): string {
    return `mongo-${sourcreOrTarget(source)}-${index}-public-ip`
}