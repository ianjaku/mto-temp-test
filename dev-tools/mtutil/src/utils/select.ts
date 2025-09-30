import { ContainerDef, listContainers } from "../utils/kube";
import { ContainerQueryOptions } from "../commands/logs";
import chalk from "chalk";
import prompts from "prompts";

const {
    gray: fgDimmed,
} = chalk;
chalk.level = 1

export async function selectContainer(
    query: string,
    options: ContainerQueryOptions,
): Promise<ContainerDef | null> {
    const parts = query?.split("/") ?? [];
    if (parts.length > 0) {
        options.namespace = parts.at(0);
        options.pod = parts.at(1);
        options.container = parts.at(2);
    }
    if (options?.verbose) {
        console.log(`Given query: ${query}`);
        console.log("Options:");
        console.dir(options);
    }
    options.query = query === options.namespace ? query : undefined;
    options.namespace = query === options.namespace ? undefined : options.namespace;
    const allContainers = await listContainers(
        parts.length > 1 ? options.namespace : null
    );
    const queryMatchingContainers = options.query ?
        allContainers.filter(c => c.container.includes(options.query)) :
        allContainers;
    if (options.query && queryMatchingContainers.length === 1) {
        return queryMatchingContainers.at(0);
    }
    const optionsMatchingContainers = filterContainers(queryMatchingContainers, options);
    if (optionsMatchingContainers.length === 1) {
        return optionsMatchingContainers.at(0);
    }
    const container = await chooseContainer(optionsMatchingContainers);
    return container;
}

function filterContainers(
    containers: ContainerDef[],
    options: ContainerQueryOptions
): ContainerDef[] {
    const hasNamespace = options?.namespace?.length > 0;
    const hasPod = options?.pod?.length > 0;
    const hasContainer = options?.container?.length > 0;
    return containers
        .filter(c =>
            (!hasNamespace || c.namespace.startsWith(options?.namespace)) &&
            (!hasPod || c.pod.startsWith(options?.pod)) &&
            (!hasContainer || c.container.startsWith(options?.container))
        );
}

async function chooseContainer(
    containers: ContainerDef[],
): Promise<ContainerDef | null> {
    if (containers.length === 1) return containers.at(0);
    console.log();
    console.log("Type to search for a container");
    console.log(" - use arrow keys to select a container");
    console.log(" - press Enter to confirm");
    console.log();
    try {
        const answer = await prompts({
            type: "autocomplete",
            name: "value",
            message: "Select container",
            choices: containers.map(c => ({ title: formatContainer(c), value: c })),
        })
        return answer.value;
    } catch (e) {
        return null;
    }
}

function formatContainer(c: ContainerDef): string {
    return [
        c.container,
        fgDimmed(c.pod),
        fgDimmed(c.namespace),
    ].join(" ");
}
