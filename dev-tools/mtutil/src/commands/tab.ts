/* eslint-disable no-console */
import { listContainers } from "../utils/kube";

const NEWLINE = "\n";

const TOP_LEVEL_COMPLETIONS = {
    "ctx": "Context management",
    "install": "Install the tool",
    "logs": "Show logs",
    "restart": "Restart a container",
    "shell": "Get a shell",
    "uninstall": "Uninstall the tool",
    "update": "Update the tool",
    "--help": "Show help",
    "--version": "Show version",
};

export async function tabComplete(
    ctx: string[],
    options?: {
        bash?: boolean;
        zsh?: boolean;
}): Promise<void> {
    if (options?.bash) ctx.shift();
    if (!ctx.at(-1)?.length) ctx.pop();

    if (ctx.length === 0) {
        const completions = options?.zsh ?
            Object.entries(TOP_LEVEL_COMPLETIONS).map(c => c.join(":")) :
            Object.keys(TOP_LEVEL_COMPLETIONS);
        console.log(completions.sort().join(NEWLINE));
        return;
    }

    const command = ctx.at(0);
    const actionQuery = ctx.at(1);

    if (!TOP_LEVEL_COMPLETIONS[command]) {
        console.log(
            Object.keys(TOP_LEVEL_COMPLETIONS).filter(
                c => c.startsWith(command)
            ).sort().join(NEWLINE)
        );
        return
    }

    if (command === "ctx") {
        const allContexts = ["dev", "stg"];
        const matchingCtxs = allContexts.filter(
            c => !actionQuery || c.startsWith(actionQuery)
        );
        if (allContexts.includes(ctx.at(1))) return;
        console.log(matchingCtxs.join(NEWLINE))
        return;
    }

    if (["logs", "restart", "shell"].includes(command)) {
        const prefix = actionQuery ?? "";
        const parts = prefix.split("/");
        const namespace = parts.at(0);
        const pod = parts.at(1);
        const container = parts.at(2);
        const validNamespace = prefix.endsWith("/") && parts.length === 2 ?
            namespace :
            undefined;
        const containers = await listContainers(validNamespace);
        const matching = containers.filter(
            c => (!namespace || c.namespace.startsWith(namespace)) &&
                (!pod || c.pod.startsWith(pod)) &&
                (!container || c.container.startsWith(container))
        ).map(
            c => `${c.namespace}/${c.pod}/${c.container}`
        );
        if (matching.includes(prefix)) return;
        console.log(matching.sort().join(NEWLINE));
        return;
    }
}
