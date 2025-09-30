import {
    getSecretForFeatureBranch,
    getSecretForReleaseBranch,
    isReleaseBranch
} from  "../../lib/secrets";
import { Env } from "../../lib/environment";
import { getCurrentBranch } from "../../actions/git/branches";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";


const doIt = async () => {
    const currentBranch = await getCurrentBranch()
    const isRelease = await isReleaseBranch(currentBranch)

    const environments: Env[] = ["dev", "staging", "production"]
    for (const environment of environments) {
        log(`Fetching secret for ${environment} environment`)
        if (isRelease) {
            await getSecretForReleaseBranch(currentBranch, environment)
        } else {
            await getSecretForFeatureBranch(currentBranch, environment)

        }
    }
}

main(doIt)


