/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { main } from "../../lib/program";
import { runCommand } from "../..//lib/commands";
interface IArgs {
    service: string;
    dir: string;
}

main(async () => {
    await runCommand("yarn", ["dlx", "unimported@1.6.0"]);
});