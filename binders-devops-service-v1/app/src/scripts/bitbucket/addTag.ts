import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { pushTag, tagHead } from "../../actions/git/tags";
import { shortenBranchName, shortenCommitRef } from "../../lib/k8s";
import { main } from "../../lib/program";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to build",
            kind: OptionType.STRING,
            required: true
        },
        commit: {
            long: "commit",
            short: "c",
            description: "The current git commit (or a fake label like 'full-<Unique ID>' to trigger a full build",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("buildNpmPackages", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any> parser.parse());
    options.branch = shortenBranchName(options.branch);
    options.commit = options.commit.startsWith("full-") ?
        options.commit :
        shortenCommitRef(options.commit);
    return options;
};


main( async () => {
    const { branch, commit } = getOptions();
    const tag = `${branch}-${commit}`;
    const message = `[PIPELINE] Successfully built branch ${branch}`;
    const shouldPush = await tagHead(tag, message, false);
    if (shouldPush) {
        await pushTag(tag, false);
    }
});