import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { main } from "../../lib/program";

const doIt = async () => {
    const args = ["exec", "-it", "local-dev", "-c", "manage-v1", "-n", "develop", "--", "/bin/bash", "-c", "yarn workspace @binders/manage-v1 node dist/src/scripts/seeds/staging.js stg7.manual.to"]
    const { output } = await buildAndRunCommand(() => buildKubeCtlCommand(args))
    // eslint-disable-next-line no-console
    console.log(output)
}

main(doIt)