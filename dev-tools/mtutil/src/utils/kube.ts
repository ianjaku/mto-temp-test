/* eslint-disable no-console */
import { Writable } from "stream";
import { execAsync } from "./exec";

export type ContainerDef = {
    ctx: string;
    container: string;
    namespace: string;
    pod: string;
}

export async function listContainers(
    namespace?: string,
): Promise<ContainerDef[]> {
    const { CoreV1Api, KubeConfig } = await import("@kubernetes/client-node");
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(CoreV1Api);
    try {
        const pods = namespace ?
            await k8sApi.listNamespacedPod({ namespace }) :
            await k8sApi.listPodForAllNamespaces();
        return pods.items.flatMap(
            pod => pod.spec?.containers.map(
                container => ({
                    ctx: kc.getCurrentContext(),
                    container: container.name,
                    namespace: pod.metadata?.namespace,
                    pod: pod.metadata?.name,
                })
            )
        );
    } catch (error) {
        console.error("Error fetching pods:", error);
        throw error;
    }
}

/**
 * Stream logs from a specified container in a Kubernetes cluster.
 */
export async function streamContainerLogs(
    container: ContainerDef,
    options?: {
        maxLines?: number;
        onMsg?: (line: string) => void;
        wait?: boolean;
    },
): Promise<void> {
    const { KubeConfig, Log } = await import("@kubernetes/client-node");
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const log = new Log(kc);

    let msgs = 0
    const logStream = new Writable({
        write(chunk, _encoding, callback) {
            options?.onMsg?.(chunk.toString());
            callback();
            msgs += 1
            if (options?.maxLines > 0 && msgs > options?.maxLines) {
                process.exit(0)
            }
        }
    });

    try {
        await log.log(
            container.namespace,
            container.pod,
            container.container,
            logStream,
            { follow: true, tailLines: 10, timestamps: false },
        );
        console.log("Started streaming logs...");
        if (!options?.wait) {
            return
        }
        return new Promise<void>((resolve) => {
            const exitHandler = () => {
                console.log("Stopping log stream...");
                resolve();
                process.exit(0);
            };

            process.on("SIGINT", exitHandler);
        });
    } catch (error) {
        console.error("Error streaming logs:", error);
    }
}

export async function switchContextExec(context: string): Promise<string> {
    const command = `kubectl config use-context ${context}`;
    return execAsync(command)
}
