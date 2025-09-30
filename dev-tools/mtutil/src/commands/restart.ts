import { ContainerQueryOptions } from "./logs";
import { execAsync } from "../utils/exec";
import { selectContainer } from "../utils/select";

export async function restartContainer(
    query: string,
    options?: ContainerQueryOptions,
): Promise<void> {
    const container = await selectContainer(query, options);
    if (!container) {
        console.log("No container selected");
        process.exit(0);
    }

    const containerId = await execAsync(`
        docker ps -q \\
            --filter label=io.kubernetes.pod.namespace="${container.namespace}" \\
            --filter label=io.kubernetes.pod.name="${container.pod}" \\
            --filter label=io.kubernetes.container.name="${container.container}"
    `);

    if (!containerId.trim().length) {
        console.error(`Container ${container.container} not found in namespace ${container.namespace} and pod ${container.pod}`);
    }

    await execAsync(`docker restart ${containerId}`);

}
