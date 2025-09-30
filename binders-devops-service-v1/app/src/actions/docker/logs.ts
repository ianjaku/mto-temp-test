import { runCommand } from "../../lib/commands";

const runDockerLogs = async (container: string, tail: number) => {
    const { output } = await runCommand(
        "docker",
        ["logs", container, "--tail", `${tail}`],
        { redirectStderrToStdout: true, mute: true }
    );
    return output;
};

export const getLogsSinceMessage = async (container: string, messagePatterns: RegExp[], tail = 100): Promise<string[]> => {
    const logs = await runDockerLogs(container, tail);
    const logLines = logs.split("\n");
    const firstOccurenceInReverse = logLines
        .reverse()
        .findIndex(line => !!messagePatterns.find(pattern => !!line.match(pattern)));
    const lastOccurrence = (firstOccurenceInReverse === -1) ?
        0 :
        logLines.length - 1 - firstOccurenceInReverse;
    return logLines.reverse()
        .slice(lastOccurrence, logLines.length - 1);
};