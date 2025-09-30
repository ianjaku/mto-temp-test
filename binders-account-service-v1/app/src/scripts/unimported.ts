/* eslint-disable @typescript-eslint/no-unused-vars */
import { main } from "@binders/binders-service-common/lib/util/process";
import { runCommand } from "@binders/binders-service-common/lib/util/process";

interface IArgs {
    service: string;
    dir: string;
}

main(async () => {
    // await runCommand("pwd && cd ../.. && pwd && ls", [], { shell: true });
    // await runCommand("pwd");
    // await runCommand("pwd", [], { cwd: dir });
    const { output } = await runCommand("yarn", ["dlx", "unimported@1.6.0"]);
    // const { output } = await runCommand("echo", ["\"test\""]);

    // await runCommand("cd", ["../.."]);
    // // const { output } = await runCommand("npx", ["unimported", dir]);
    if (!output.includes("There don't seem to be any unimported files.")) {
        throw new Error(`Unresolved/unused/unimported files/deps detected. Fix them or update .unimportedrc.json. Files: ${output}`)
    }
    // console.log("OUTPUT", output);
    // await runCommand("echo", [service, "and", dir]);
});