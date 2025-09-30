import { Env } from "../../lib/environment";
import { getTerraformOutputSecret } from "../../lib/secrets";
import log from "../../lib/logging";
import { main } from "../../lib/program";


const doIt = async () => {

    const environments: Env[] = ["dev", "staging", "production"]
    for (const environment of environments) {
        log(`Fetching secret for ${environment} environment`)
        await getTerraformOutputSecret(environment)
    }
}

main(doIt)


