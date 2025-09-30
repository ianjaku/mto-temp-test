import { main } from "../../lib/program";
import { maybeInstallEckOperator } from "../../actions/elastic/eck";

const doIt = async () => {
    await maybeInstallEckOperator()
}

main(doIt)