import { main } from "../../lib/program"
import { runInstallIngressController } from "../../lib/install";

const doIt = async () => {
    await runInstallIngressController("production", "23.100.6.183");
}

main(doIt);