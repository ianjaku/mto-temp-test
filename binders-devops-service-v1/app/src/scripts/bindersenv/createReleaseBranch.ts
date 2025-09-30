import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { Env } from "../../lib/environment";
import { createAndPushReleaseBranch } from "../../actions/git/branches";
import { createReleaseSecretFromOtherBranch } from "../../lib/secrets";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

interface CreateReleaseOptions {
    releaseBranchName: string;
    sourceBranchName: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        releaseBranchName: {
            long: "releaseBranchName",
            short: "r",
            description: "Release branch name",
            kind: OptionType.STRING,
            required: true
        },
        sourceBranchName: {
            long: "sourceBranchName",
            short: "s",
            description: "Source branch name (defaulted to develop)",
            kind: OptionType.STRING,
            required: true,
            default: "develop"
        }

    }
    const parser = new CommandLineParser("CreateReleaseOptions", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { releaseBranchName, sourceBranchName } = (<any>parser.parse()) as CreateReleaseOptions
    return {
        releaseBranchName,
        sourceBranchName
    }
}

const doIt = async () => {
    const { releaseBranchName, sourceBranchName } = getOptions()

    if (!releaseBranchName.startsWith("rel")) {
        throw new Error("Release name should start with prefix: rel")
    }

    await createAndPushReleaseBranch(sourceBranchName, releaseBranchName)
    const environments: Env[] = ["dev", "staging", "production"]
    for (const environment of environments) {
        log(`Creating secret for ${environment} environment, source branch: ${sourceBranchName}, release branch ${releaseBranchName}`)
        await createReleaseSecretFromOtherBranch(sourceBranchName, releaseBranchName, environment)
    }

};

main(doIt);