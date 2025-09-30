import { ContainerQueryOptions } from "./logs";
import { selectContainer } from "../utils/select";
import { spawn } from "child_process";

export async function shellContainer(
    query: string,
    options?: ContainerQueryOptions,
): Promise<void> {
    const container = await selectContainer(query, options);
    if (!container) {
        console.log("No container selected");
        process.exit(0);
    }

    const shell = container.container.includes("redis") ? "sh" : "bash";
    const args = [
        "-n",
        container.namespace,
        "exec",
        "-it",
        container.pod,
        "-c",
        container.container,
        "--",
        shell,
    ];
    const kubectlProcess = spawn("kubectl", args, { stdio: "inherit" });
    kubectlProcess.on("exit", (code) => {
        console.log(`Exited with code ${code}`);
        process.exit(code);
    });
    kubectlProcess.on("error", (err) => {
        console.error("Failed to start kubectl:", err);
        process.exit(1);
    });
}
