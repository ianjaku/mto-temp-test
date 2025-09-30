import { Command } from "commander";
import chalk from "chalk";
import { logErrors } from "./utils";
import mtoHeader from "./utils/mtAscii";
import { restartContainer } from "./commands/restart";
import { shellContainer } from "./commands/shell";
import { streamLogs } from "./commands/logs";
import { switchContext } from "./commands/ctx";
import { tabComplete } from "./commands/tab";

chalk.level = 1

const program = new Command();

const SCRIPTNAME = "mto";
const VERSION = "0.0.1";

function header() {
    console.error();
    console.error(mtoHeader);
}

if (process.argv.length === 2 ||
    process.argv[2] === "help" ||
    process.argv.includes("-h") ||
    process.argv.includes("--help")
) {
    header();
}

program
    .name(SCRIPTNAME)
    .description("Manualto CLI utility")
    .version(VERSION);

program
    .command("ctx [context]")
    .description("Switch kubectl context")
    .action(logErrors(context => switchContext(context)))

program
    .command("logs [query]")
    .description("Stream logs from a Kubernetes container")
    .option("-n, --namespace [namespace]", "Kube namespace - develop, rel-may-24, ...")
    .option("-p, --pod [pod]", "Pod name prefix - localdev, rel-may24-, rel-may-24/rel-, ...")
    .option("-c, --container [container]", "Container name prefix - account-v1, acc")
    .option("-l, --limit [number]", "Stream until N lines been read. If <= 0, will stream indefinitely")
    .action(logErrors((query, cmd) => streamLogs(query, cmd.opts())));

program
    .command("restart [query]")
    .description("Restart any container")
    .option("-n, --namespace [namespace]", "Kube namespace - develop, rel-may-24, ...")
    .option("-p, --pod [pod]", "Pod name prefix - localdev, rel-may24-, rel-may-24/rel-, ...")
    .option("-c, --container [container]", "Container name prefix - account-v1, acc")
    .action(logErrors((query, cmd) => restartContainer(query, cmd.opts())));

program
    .command("shell [query]")
    .description("Get a shell in any container")
    .option("-n, --namespace [namespace]", "Kube namespace - develop, rel-may-24, ...")
    .option("-p, --pod [pod]", "Pod name prefix - localdev, rel-may24-, rel-may-24/rel-, ...")
    .option("-c, --container [container]", "Container name prefix - account-v1, acc")
    .action(logErrors((query, cmd) => shellContainer(query, cmd.opts())));

program
    .command("tab [contexts...]")
    .description("Complete mto command (used by shell tab completion)")
    .option("--quiet", "Do not output header, etc")
    .option("-b, --bash", "Tab completion for bash")
    .option("-z, --zsh", "Tab completion for zsh")
    .action(logErrors((contexts, cmd) => tabComplete(contexts, cmd.opts())))

if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit();
}

program.parse(process.argv);
