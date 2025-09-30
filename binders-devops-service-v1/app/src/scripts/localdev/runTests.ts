import { ALL_SCRIPTS,
    WorkspaceScriptName,
    executeScriptPlan,
    filterPackageScripts,
    filterWorkspacesWithScripts,
    loadAllPackageJsons,
    localManageYarnLaunch,
    printScriptsMatrix,
    printScriptsResults,
} from "../../lib/tests";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { formatDuration, splitLine } from "../../lib/utils";
import { pluck, sum } from "ramda";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import log from "../../lib/logging";
import { main } from "../../lib/program";

interface RunTestsOptions {
    scripts: string,
    workspaces: string,
    ignore?: string,
    dryRun?: boolean,
    mute?: boolean,
    threads?: number,
}

const getOptions = async () => {
    const programDefinition: IProgramDefinition = {
        scripts: {
            long: "scripts",
            short: "s",
            default: "all",
            description: `Comma separated list of scripts - one of [${ALL_SCRIPTS.join(",")}]. Use 'all' to run all scripts`,
            kind: OptionType.STRING,
        },
        workspaces: {
            long: "workspaces",
            short: "w",
            default: "all",
            kind: OptionType.STRING,
            description: "Comma separated list of workspaces to run the scripts. Use 'all' to run on all workspaces",
        },
        ignore: {
            long: "ignore",
            short: "i",
            required: false,
            kind: OptionType.STRING,
            description: "Comma separated list of workspaces to ignore",
        },
        mute: {
            long: "mute",
            short: "m",
            default: false,
            kind: OptionType.BOOLEAN,
            description: "Mute stdout and stderr",
        },
        dryRun: {
            long: "dryRun",
            short: "d",
            default: false,
            kind: OptionType.BOOLEAN,
            description: "If set, will not run the scripts",
        },
        threads: {
            long: "threads",
            short: "t",
            default: 1,
            kind: OptionType.INTEGER,
            description: "If set to N, will run the scripts in N 'threads'. If set to 0, let node figure it out.",
        }
    };
    const parser = new CommandLineParser("runTests.ts", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { scripts, workspaces, ignore, dryRun, mute, threads } = (<any>parser.parse()) as RunTestsOptions;

    return {
        scripts: scripts === "all" ? [] : splitLine(scripts) as WorkspaceScriptName[],
        workspaces: workspaces === "all" ? [] : splitLine(workspaces),
        ignore: splitLine(ignore),
        dryRun,
        mute,
        threads: Math.max(0, threads || 0),
    };
}

async function doIt() {
    const cwd = process.cwd();
    const repoRoot = await getLocalRepositoryRoot();

    const allWorkspaces = filterPackageScripts(await loadAllPackageJsons(), ALL_SCRIPTS);
    const options = await getOptions();

    options.scripts = options.scripts.length ? options.scripts : ALL_SCRIPTS;
    options.workspaces = options.workspaces.length ? options.workspaces : pluck("name", allWorkspaces);

    const workspaces = allWorkspaces.filter(pkg => options.workspaces.includes(pkg.name));

    const executionPlan = filterWorkspacesWithScripts(workspaces, options.scripts, { matchAll: false });

    log({ cwd, repoRoot, options });
    log();

    log("all workspaces");
    log();
    printScriptsMatrix(allWorkspaces);

    log("script execution plan");
    log();
    printScriptsMatrix(executionPlan);

    const start = new Date().getTime();

    const results = await executeScriptPlan(repoRoot, executionPlan, localManageYarnLaunch, options);

    log();
    printScriptsResults(results);
    log(`total CPU time ${formatDuration(sum(pluck("duration", results)))}`);
    log(`took ${formatDuration(new Date().getTime() - start)}`);
}

main(doIt);