import { runCommand } from "../../lib/commands";

export const restartContainer = async (containerIdOrName: string): Promise<void> => {
    await runCommand("docker", ["restart", containerIdOrName], { mute : true });
};

export const restartContainers = async (containerIdOrNames: string[]): Promise<void> => {
    await runCommand("docker", ["restart", ...containerIdOrNames], { mute: true});
}