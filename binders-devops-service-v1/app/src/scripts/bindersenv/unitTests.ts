import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    executeScriptPlan,
    filterWorkspacesWithScripts,
    getWorkspacesToTest,
    localYarnLaunch,
    printScriptsMatrix,
    printScriptsResults,
    verifyScriptsResults
} from "../../lib/tests";
import {
    runClientTranspile,
    runCommonTranspile,
    runUIKitTranspile
} from "../../actions/bindersenv/pipeline";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { splitLine } from "../../lib/utils";

type Options = {
    dryRun: boolean;
    mute: boolean;
    packages: string;
    skipUnchangedWorkspaces: boolean;
    threads: number;
    quiet: boolean;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        packages: {
            long: "packages",
            short: "p",
            description: "Comma separated list of packages to test. Use 'all' to test all packages (default)",
            kind: OptionType.STRING,
            default: "all"
        },
        mute: {
            long: "mute",
            short: "m",
            description: "Mute stdout",
            kind: OptionType.BOOLEAN,
            default: false
        },
        quiet: {
            long: "quiet",
            short: "q",
            description: "Do not fail on script errors, only log the results",
            kind: OptionType.BOOLEAN,
            default: false
        },
        dryRun: {
            long: "dryRun",
            short: "d",
            default: false,
            kind: OptionType.BOOLEAN,
            description: "If set, will not run the tests",
        },
        threads: {
            long: "threads",
            short: "t",
            default: 1,
            kind: OptionType.INTEGER,
            description: "If set to N, will split testing into N threads. If set to 0, let node figure it out.",
        },
        skipUnchangedWorkspaces: {
            long: "skipUnchangedWorkspaces",
            short: "s",
            default: false,
            kind: OptionType.BOOLEAN,
            description: "Only run unit tests for workspaces that have changed since the last succesful build",
        }
    };
    const parser = new CommandLineParser("unitTests", programDefinition);
    const options = parser.parse<Options>();
    return {
        ...options,
        packages: new Set(options.packages === "all" ? [] : splitLine(options.packages))
    }
};

const doIt = async () => {
    const options = getOptions();

    if (process.env.SKIP_UNIT_TESTS === "1") {
        log(`Skipping unit tests for ${[...options.packages].join(" ")} workspaces`);
        process.exit(0);
    }

    const repoRoot = await getLocalRepositoryRoot();
    await runClientTranspile(repoRoot);
    await runCommonTranspile(repoRoot);
    await runUIKitTranspile(repoRoot);

    const workspacesToTest = await getWorkspacesToTest(options.skipUnchangedWorkspaces);
    const filteredWorkspaces = options.packages.size === 0 ? workspacesToTest : workspacesToTest.filter(w => options.packages.has(w.name));
    const executionPlan = filterWorkspacesWithScripts(filteredWorkspaces, ["unittest"]);

    if (executionPlan.length === 0) {
        log("No unit tests to run");
        return;
    }

    printScriptsMatrix(executionPlan);

    const results = await executeScriptPlan(
        repoRoot,
        executionPlan,
        localYarnLaunch,
        options,
    );

    printScriptsResults(results);
    verifyScriptsResults(results, { quiet: options.quiet });
}

main(doIt);
