import { info, panic } from "@binders/client/lib/util/cli";
import { Command } from "commander";
import { main } from "../../lib/program";
import { waitForMongoPod } from "../../actions/mongo/k8s";
const SCRIPT_NAME = "ensureMongoPodIsRunning";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Scipt checks if mongo is in running state and mongo server is responding")
    .option("-n, --namespace [namespace]", "If set, will not change any data")

program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    namespace?: string;
};

main(async () => {
    if (!options.namespace) {
        panic("Missing namespace parameter. Can't check mongo pod status")
    }
    info(`Checking mongo pod in namespace: ${options.namespace}`)
    await waitForMongoPod(options.namespace)
})