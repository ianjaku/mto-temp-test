import { buildLogger } from "../logs/logger";
import { selectContainer } from "../utils/select";
import { streamContainerLogs } from "../utils/kube";

export type ContainerQueryOptions = {
    namespace?: string;
    pod?: string;
    container?: string;
    query?: string;
    limit?: string;
    preset?: string;
    verbose?: string;
}

export async function streamLogs(
    query?: string,
    options?: ContainerQueryOptions,
): Promise<void> {
    const maxLines = +(options.limit ?? 0);
    const container = await selectContainer(query, options);
    if (!container) {
        console.log("No container selected");
        process.exit(0);
    }
    const logger = buildLogger(options?.preset ?? "minimal");
    await streamContainerLogs(container, { onMsg: logger, wait: true, maxLines })
}
